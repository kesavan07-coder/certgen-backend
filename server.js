const express    = require("express");
const nodemailer = require("nodemailer");
const cors       = require("cors");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [/\.netlify\.app$/, /\.vercel\.app$/, "http://localhost:5173"],
  methods: ["POST","GET"],
}));
app.use(express.json({ limit: "15mb" }));

app.get("/", (req, res) => res.json({ status: "ok", message: "CertGen Pro Email Server 🎓" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const makeTransporter = () => nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { 
    user: process.env.GMAIL_USER, 
    pass: (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "") 
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
});

const buildHtml = (to_name, message) => `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:28px;border-radius:12px;">
  <h2 style="color:#4a0e8f;">🎓 Certificate of Participation</h2>
  <p style="font-size:15px;color:#333;line-height:1.7;">${(message||"Congratulations!").replace(/\n/g,"<br/>")}</p>
  <div style="background:#f0ebff;border:1px solid #c4b5fd;border-radius:8px;padding:14px;margin:16px 0;text-align:center;">
    <p style="margin:0;color:#4a0e8f;font-size:14px;font-weight:bold;">📎 Your certificate PDF is attached to this email</p>
    <p style="margin:6px 0 0;color:#666;font-size:12px;">Open the attachment to view or print your certificate.</p>
  </div>
  <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;"/>
  <p style="font-size:11px;color:#aaa;text-align:center;">Sent by CertGen Pro • Kesavan K • Google Student Ambassador</p>
</div>`;

app.post("/send-certificate", async (req, res) => {
  const { to_email, to_name, subject, message, pdf_base64, img_base64 } = req.body;
  if (!to_email || !to_name || !pdf_base64) return res.status(400).json({ error: "Missing fields" });
  if (!process.env.GMAIL_USER) return res.status(500).json({ error: "Server not configured" });
  try {
    const pdfData = pdf_base64.includes(",") ? pdf_base64.split(",")[1] : pdf_base64;
    await makeTransporter().sendMail({
      from:    `"Kesavan K - GSA" <${process.env.GMAIL_USER}>`,
      to:      to_email,
      subject: subject || `🎓 Your Certificate — ${to_name}`,
      html:    buildHtml(to_name, message),
      attachments: [
        { filename: `${to_name.replace(/[^a-zA-Z0-9 ]/g,"")}_Certificate.pdf`, content: pdfData, encoding: "base64", contentType: "application/pdf" },
      ],
    });
    console.log(`✅ Sent to ${to_email}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ ${to_email}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/send-bulk", async (req, res) => {
  const { recipients, subject, message } = req.body;
  if (!Array.isArray(recipients)) return res.status(400).json({ error: "recipients array required" });
  if (!process.env.GMAIL_USER) return res.status(500).json({ error: "Server not configured" });
  const results = [];
  for (const r of recipients) {
    const { to_email, to_name, pdf_base64 } = r;
    if (!to_email || !to_name || !pdf_base64) { results.push({ to_email, to_name, status:"skipped" }); continue; }
    const pdfData = pdf_base64.includes(",") ? pdf_base64.split(",")[1] : pdf_base64;
    const personalMsg = (message||"Hi {name}, congrats!").replace(/{name}/gi, to_name);
    try {
      await makeTransporter().sendMail({
        from:    `"Kesavan K - GSA" <${process.env.GMAIL_USER}>`,
        to:      to_email,
        subject: (subject||"🎓 Your Certificate — {name}").replace(/{name}/gi, to_name),
        html:    buildHtml(to_name, personalMsg),
        attachments: [{ filename: `${to_name.replace(/[^a-zA-Z0-9 ]/g,"")}_Certificate.pdf`, content: pdfData, encoding:"base64", contentType:"application/pdf" }],
      });
      results.push({ to_email, to_name, status:"sent" });
    } catch(err) { results.push({ to_email, to_name, status:"failed", reason:err.message }); }
    await new Promise(r=>setTimeout(r,400));
  }
  res.json({ results });
});

app.listen(PORT, () => {
  console.log(`🎓 CertGen Pro Backend on port ${PORT}`);
  console.log(`   GMAIL_USER: ${process.env.GMAIL_USER||"⚠️ NOT SET"}`);
  console.log(`   GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD?"✅ SET":"⚠️ NOT SET"}`);
});
