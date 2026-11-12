const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const path = require("path");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const cors = require("cors");
const bcrypt = require("bcryptjs");
const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.resolve(__dirname, "../public")));

app.get("/", (req, res) => {
  res.redirect("/log-in");
});

app.get("/test", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/test.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/login.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/dashboard.html"));
});

app.get("/sign-in", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/sign-in.html"));
});

app.get("/log-in", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/log-in.html"));
});

app.get("/account", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/account.html"));
});

app.get("/index", (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

app.get("/sign-in.html", (req, res) => res.redirect(301, "/sign-in"));
app.get("/log-in.html", (req, res) => res.redirect(301, "/log-in"));
app.get("/account.html", (req, res) => res.redirect(301, "/account"));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function initFirebase() {
  if (admin.apps.length) return;

  if (!process.env.FIREBASE_CONFIG) {
    throw new Error("Missing FIREBASE_CONFIG env var");
  }
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error("Missing FIREBASE_STORAGE_BUCKET env var");
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

function firestore() {
  initFirebase();
  return admin.firestore();
}

function nowISO() {
  return new Date().toISOString();
}

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE || "gmail",
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
  }
});

async function telegramNotify(text) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = new URLSearchParams({
      chat_id: String(chatId),
      text: String(text),
      parse_mode: "HTML"
    });

    await fetch(url, { method: "POST", body });
  } catch (e) {
    console.error("Telegram notify failed:", e?.message || e);
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies?.admin_token ||
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);

    if (!token) return res.status(403).json({ success: false, message: "غير مصرح" });

    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(403).json({ success: false, message: "غير مصرح" });
  }
}

function setAdminCookie(res, token) {
  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function requireUser(req, res, next) {
  try {
    const token = req.cookies?.user_token ||
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);

    if (!token) return res.status(401).json({ success: false, message: "غير مصرح، يرجى تسجيل الدخول" });

    const payload = jwt.verify(token, process.env.USER_JWT_SECRET || process.env.ADMIN_JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: "جلسة غير صالحة، يرجى تسجيل الدخول" });
  }
}

function setUserCookie(res, token, remember) {
  const maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  res.cookie("user_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge
  });
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    try {
      const parts = String(stored || "").split("$");
      if (parts.length !== 3 || parts[0] !== "scrypt") return resolve(false);
      const salt = parts[1];
      const expected = Buffer.from(parts[2], "hex");
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        if (derivedKey.length !== expected.length) return resolve(false);
        try {
          resolve(crypto.timingSafeEqual(derivedKey, expected));
        } catch {
          resolve(false);
        }
      });
    } catch (e) {
      resolve(false);
    }
  });
}

function generateBaseId() {
  const num = crypto.randomInt(10000000, 99999999);
  return `JS-${num}`;
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

async function uploadToCloudinary(file) {
  if (!file) return null;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "orders", resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

async function uploadScreenshotToCloudinary(file) {
  if (!file) return null;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "screenshots", resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

function buildWelcomeEmailHtml(name, accountUrl) {
  const safeName = String(name || "").replace(/[<>&"]/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;"
  }[c]));
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>مرحبًا بك في John Store</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:'Cairo','Tajawal',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e0e0e0;box-shadow:0 4px 15px rgba(0,0,0,0.05);">
          
          <tr>
            <td align="center" style="background-color:#1a1a2e;padding:35px 20px;">
              <img src="cid:johnstore-logo" alt="John Store" width="80" height="80" style="border-radius:50%;border:3px solid #ffb800;display:block;margin-bottom:15px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:bold;letter-spacing:1px;">John <span style="color:#ffb800;">Store</span></h1>
              <p style="margin:5px 0 0 0;color:#a0a0b0;font-size:14px;">متجر شحن شدات ببجي</p>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 20px;">
              <h2 style="color:#333333;margin-top:0;font-size:20px;border-bottom:2px solid #ffb800;padding-bottom:10px;display:inline-block;">مرحبًا ${safeName}،</h2>
              
              <p style="color:#444444;line-height:1.8;font-size:16px;margin-top:20px;">
                تم إنشاء حسابك بنجاح على <strong style="color:#ff7a00;">John Store</strong>.
              </p>
              <p style="color:#444444;line-height:1.8;font-size:16px;">
                <strong>اسم المستخدم:</strong> ${safeName}
              </p>
              <p style="color:#444444;line-height:1.8;font-size:16px;">
                يمكنك الوصول إلى منطقة حسابك لعرض الطلبات، وتغيير كلمة المرور الخاصة بك والمزيد عبر الرابط أدناه:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px auto;">
                <tr>
                  <td align="center" style="border-radius:8px;background:#ffb800;">
                    <a href="${accountUrl}" target="_blank" style="display:inline-block;padding:14px 34px;color:#000;text-decoration:none;font-weight:bold;font-size:16px;border-radius:8px;">
                      لوحة حسابي
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#888888;font-size:14px;text-align:center;margin-top:30px;">
                Welcome To <strong style="color:#ff7a00;">John Store</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="background-color:#f1f3f5;padding:20px;border-top:1px solid #e0e0e0;">
              <p style="margin:0;color:#888888;font-size:13px;line-height:1.6;">
                هذا البريد إلكتروني آلي، يرجى عدم الرد عليه.<br>
                © ${new Date().getFullYear()} John Store - جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendWelcomeEmail(name, email) {
  console.log("🔄 محاولة إرسال إيميل ترحيبي إلى:", email);
  const from = process.env.SMTP_USER || process.env.EMAIL_USER;
  if (!from) {
    console.error("Welcome email skipped: missing SMTP_USER/EMAIL_USER");
    return;
  }
  const baseUrl = (process.env.APP_BASE_URL || "https://trip-store.vercel.app").replace(/\/+$/, "");
  const accountUrl = `${baseUrl}/account`;
  try {
    const info = await transporter.sendMail({
      from: `"John Store" <${from}>`,
      to: email,
      subject: "مرحبًا بك في John Store — تم إنشاء حسابك",
      attachments: [{
        filename: 'john-store.png',
        path: 'https://i.postimg.cc/x8xtX2KR/john-store.png',
        cid: 'johnstore-logo'
      }],
      html: buildWelcomeEmailHtml(name, accountUrl),
      text: `مرحبًا ${name},\n\nتم إنشاء حسابك على John Store.\nاسم المستخدم: ${name}\n\nيمكنك الوصول إلى منطقة حسابك عبر الرابط:\n${accountUrl}\n\nWelcome To John Store.`
    });
    console.log("Welcome email sent:", info.messageId);
  } catch (e) {
    console.error("Welcome email failed:", e?.message || e);
  }
}

app.get("/api/health", (req, res) => {
  res.json({ success: true, time: nowISO() });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, customId } = req.body || {};

    if (!name || !email || !password || !customId) {
      return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة بما فيها الـ ID" });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanId = String(customId).trim();
    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;

    if (cleanName.length < 3) {
      return res.status(400).json({ success: false, message: "الاسم يجب أن يكون 3 أحرف على الأقل" });
    }
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "صيغة البريد الإلكتروني غير صحيحة" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    }
    if (cleanId.length < 5) {
      return res.status(400).json({ success: false, message: "ID الحساب يجب أن يكون 5 أرقام على الأقل" });
    }

    const usersCol = firestore().collection("users");

    const existingEmail = await usersCol.where("email", "==", cleanEmail).limit(1).get();
    if (!existingEmail.empty) {
      return res.status(409).json({ success: false, message: "هذا البريد الإلكتروني مسجل بالفعل" });
    }

    const existingId = await usersCol.where("baseId", "==", cleanId).limit(1).get();
    if (!existingId.empty) {
      return res.status(409).json({ success: false, message: "هذا الـ ID مستخدم بالفعل، يرجى اختيار ID آخر" });
    }

    const passwordHash = await hashPassword(String(password));

    const userData = {
      name: cleanName,
      email: cleanEmail,
      baseId: cleanId,
      passwordHash,
      role: "user",
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: null,
      loginCount: 0
    };

    const ref = await usersCol.add(userData);

    await firestore().collection("login_logs").add({
      userId: ref.id, name: cleanName, email: cleanEmail, event: "signup", success: true,
      ip: getClientIp(req), userAgent: req.headers["user-agent"] || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    sendWelcomeEmail(cleanName, cleanEmail).catch((e) => console.error(e));

    const token = jwt.sign(
      { uid: ref.id, email: cleanEmail, name: cleanName, baseId: cleanId, role: "user" },
      process.env.USER_JWT_SECRET || process.env.ADMIN_JWT_SECRET,
      { expiresIn: "30d" }
    );
    setUserCookie(res, token, true);

    return res.status(201).json({
      success: true, message: "تم إنشاء الحساب بنجاح",
      user: { id: ref.id, name: cleanName, email: cleanEmail, baseId: cleanId },
      redirect: "/"
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء إنشاء الحساب" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, remember, userAgent } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "البريد وكلمة المرور مطلوبان" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const usersCol = firestore().collection("users");
    const snap = await usersCol.where("email", "==", cleanEmail).limit(1).get();

    const ip = getClientIp(req);
    const ua = userAgent || req.headers["user-agent"] || null;

    if (snap.empty) {
      await firestore().collection("login_logs").add({
        userId: null, email: cleanEmail, event: "login", success: false, reason: "user_not_found",
        ip, userAgent: ua, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(401).json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    const userDoc = snap.docs[0];
    const user = userDoc.data();

    if (user.isActive === false) {
      await firestore().collection("login_logs").add({
        userId: userDoc.id, name: user.name || null, email: cleanEmail, event: "login", success: false, reason: "inactive",
        ip, userAgent: ua, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(403).json({ success: false, message: "هذا الحساب موقوف، يرجى التواصل مع الدعم" });
    }

    const ok = await verifyPassword(String(password), user.passwordHash);
    if (!ok) {
      await firestore().collection("login_logs").add({
        userId: userDoc.id, name: user.name || null, email: cleanEmail, event: "login", success: false, reason: "wrong_password",
        ip, userAgent: ua, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(401).json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    await userDoc.ref.update({
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      loginCount: admin.firestore.FieldValue.increment(1)
    });

    await firestore().collection("login_logs").add({
      userId: userDoc.id, name: user.name || null, email: cleanEmail, event: "login", success: true,
      ip, userAgent: ua, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const token = jwt.sign(
      { uid: userDoc.id, email: user.email, name: user.name, baseId: user.baseId, role: "user" },
      process.env.USER_JWT_SECRET || process.env.ADMIN_JWT_SECRET,
      { expiresIn: remember ? "30d" : "1d" }
    );
    setUserCookie(res, token, !!remember);

    return res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      user: { id: userDoc.id, name: user.name, email: user.email, baseId: user.baseId },
      redirect: "/"
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء تسجيل الدخول" });
  }
});

app.get("/api/auth/me", requireUser, async (req, res) => {
  try {
    const doc = await firestore().collection("users").doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    const u = doc.data();
    res.json({
      success: true,
      user: {
        id: doc.id, name: u.name, email: u.email, baseId: u.baseId,
        role: u.role || "user", isActive: u.isActive !== false
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في جلب البيانات" });
  }
});

app.put("/api/auth/update", requireUser, async (req, res) => {
  try {
    const { name, customId } = req.body;
    const userRef = firestore().collection("users").doc(req.user.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    
    const updateData = {};
    if (name && name.trim().length >= 3) updateData.name = name.trim();
    
    if (customId && customId.trim() !== userDoc.data().baseId) {
      const cleanId = String(customId).trim();
      if (cleanId.length < 5) return res.status(400).json({ success: false, message: "ID الحساب يجب أن يكون 5 أرقام على الأقل" });
      
      const dup = await firestore().collection("users").where("baseId", "==", cleanId).limit(1).get();
      if (!dup.empty) return res.status(409).json({ success: false, message: "هذا الـ ID مستخدم بالفعل" });
      updateData.baseId = cleanId;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "لا توجد بيانات للتحديث" });
    }

    await userRef.update(updateData);
    res.json({ success: true, message: "تم تحديث البيانات بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء التحديث" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("user_token");
  res.json({ success: true });
});

app.get("/api/account/orders", requireUser, async (req, res) => {
  try {
    const userDoc = await firestore().collection("users").doc(req.user.uid).get();
    const userEmail = userDoc.exists ? userDoc.data().email : req.user.email;

    const snap = await firestore().collection("orders").where("userId", "==", req.user.uid).get();
    const snapByEmail = await firestore().collection("orders").where("email", "==", userEmail).get();

    const ordersMap = new Map();
    snap.docs.forEach(d => ordersMap.set(d.id, d));
    snapByEmail.docs.forEach(d => ordersMap.set(d.id, d));

    const data = await Promise.all(Array.from(ordersMap.values()).map(async d => {
      const o = d.data();
      let createdAt = null;
      if (o.created_at && o.created_at.toDate) createdAt = o.created_at.toDate().toISOString();
      
      const screensSnap = await firestore().collection("screenshots").where("orderId", "==", d.id).get();
      const screens = screensSnap.docs.map(s => ({ id: s.id, imageUrl: s.data().imageUrl }));

      return {
        id: d.id, playerId: o.playerId || null, name: o.name || null, type: o.type || null,
        ucAmount: o.ucAmount || null, bundle: o.bundle || null, totalAmount: o.totalAmount || 0,
        status: o.status || null, transactionId: o.transactionId || null,
        screenshotUrl: o.screenshotUrl || null, created_at: createdAt,
        screens: screens
      };
    }));

    data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في جلب الشحنات" });
  }
});

app.get("/api/account/screens", requireUser, async (req, res) => {
  try {
    const userDoc = await firestore().collection("users").doc(req.user.uid).get();
    if (!userDoc.exists) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    const user = userDoc.data();

    const snap = await firestore().collection("screenshots").where("targetBaseId", "==", user.baseId).get();

    const data = snap.docs.map(d => {
      const s = d.data();
      let createdAt = null;
      if (s.createdAt && s.createdAt.toDate) createdAt = s.createdAt.toDate().toISOString();
      return { id: d.id, imageUrl: s.imageUrl, label: s.label || null, targetBaseId: s.targetBaseId || null, createdAt };
    });

    data.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في جلب السكرينات" });
  }
});

app.post("/api/order", upload.single("screenshot"), async (req, res) => {
  try {
    const { name, playerId, email, ucAmount, bundle, totalAmount, transactionId, couponCode, discountAmount } = req.body;

    if (!name || !playerId || !email || !totalAmount || (!ucAmount && !bundle)) {
      return res.status(400).json({ success: false, message: "جميع الحقول الأساسية مطلوبة" });
    }

    const type = ucAmount ? "UC" : "Bundle";
    let screenshotUrl = null;

    if (req.file) {
      try {
        screenshotUrl = await uploadToCloudinary(req.file);
      } catch (uploadErr) {
        console.error("Upload error:", uploadErr);
      }
    }

    let userId = null;
    try {
      const token = req.cookies?.user_token;
      if (token) {
        const payload = jwt.verify(token, process.env.USER_JWT_SECRET || process.env.ADMIN_JWT_SECRET);
        userId = payload.uid || null;
      }
    } catch { }

    const orderData = {
      name, playerId, email, type, userId,
      ucAmount: ucAmount || null, bundle: bundle || null, totalAmount: Number(totalAmount),
      transactionId: transactionId || null, screenshotUrl: screenshotUrl, status: "لم يتم الدفع",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      couponCode: couponCode || null, discountAmount: discountAmount ? Number(discountAmount) : null
    };

    const ref = await firestore().collection("orders").add(orderData);

    telegramNotify(`🧾 طلب جديد\nالاسم: ${name}\nايدي اللاعب: ${playerId}\nالبريد: ${email}\nالنوع: ${type}\nالإجمالي: ${totalAmount}\nID: ${ref.id}`).catch(e => console.error(e));

    const notifyTo = process.env.ADMIN_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER;
    if (notifyTo) {
      transporter.sendMail({
        from: `"Trip Store" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
        to: notifyTo, subject: "طلب جديد",
        html: `<div dir="rtl"><h2>طلب جديد</h2><p><b>الاسم:</b> ${name}</p><p><b>ايدي-اللاعب:</b> ${playerId}</p><p><b>البريد:</b> ${email}</p><p><b>النوع:</b> ${type}</p><p><b>الإجمالي:</b> ${totalAmount}</p>${screenshotUrl ? `<p><a href="${screenshotUrl}">صورة التحويل</a></p>` : ""}</div>`
      }).catch(e => console.error(e));
    }

    return res.status(200).json({ success: true, id: ref.id, message: "تم إنشاء الطلب بنجاح" });
  } catch (err) {
    console.error("Error in /api/order:", err);
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء الحفظ: " + (err.message || "خطأ غير معروف") });
  }
});

app.get("/api/order/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await firestore().collection("orders").doc(id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    const data = doc.data();
    if (data.created_at && data.created_at.toDate) data.created_at = data.created_at.toDate().toISOString();
    res.json({ success: true, data: { id: doc.id, ...data } });
  } catch (err) {
    res.status(500).json({ success: false, message: "خطأ في جلب الطلب" });
  }
});

app.post("/api/order/confirm-payment", upload.single("screenshot"), async (req, res) => {
  try {
    const { orderId, transactionId } = req.body;
    if (!orderId || !transactionId) return res.status(400).json({ success: false, message: "رقم الطلب ورقم المعاملة مطلوبان" });

    let screenshotUrl = null;
    if (req.file) screenshotUrl = await uploadToCloudinary(req.file);

    const updateData = {
      transactionId, status: "تم الدفع - قيد المراجعة",
      payment_confirmed_at: admin.firestore.FieldValue.serverTimestamp()
    };
    if (screenshotUrl) updateData.screenshotUrl = screenshotUrl;

    await firestore().collection("orders").doc(orderId).update(updateData);
    const orderDoc = await firestore().collection("orders").doc(orderId).get();
    const orderData = orderDoc.data();
    await telegramNotify(`💰 تم تأكيد الدفع\nرقم الطلب: ${orderId}\nرقم المعاملة: ${transactionId}\nالمبلغ: ${orderData.totalAmount}\nالعميل: ${orderData.name}`);
    res.json({ success: true, message: "تم تأكيد الدفع بنجاح", screenshotUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "حدث خطأ: " + (err.message || "خطأ غير معروف") });
  }
});

app.post("/api/inquiry", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!email || !message) return res.status(400).json({ success: false, message: "البريد الإلكتروني والرسالة مطلوبان" });

    const inquiryData = {
      name: name || "غير مذكور", email: email, message: message,
      status: "قيد الانتظار", created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    const ref = await firestore().collection("inquiries").add(inquiryData);

    telegramNotify(`📩 استفسار جديد\nالاسم: ${name || "غير مذكور"}\nالبريد: ${email}\nالرسالة: ${message.substring(0, 100)}`).catch(e => console.error("Telegram notify error:", e));

    const notifyTo = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    if (notifyTo) {
      transporter.sendMail({
        from: `"فريق الدعم" <${process.env.SMTP_USER}>`,
        to: notifyTo, subject: "📩 استفسار جديد على الموقع",
        html: `<div dir="rtl"><h3>استفسار جديد</h3><p><strong>الاسم:</strong> ${name || "غير مذكور"}</p><p><strong>البريد:</strong> ${email}</p><p><strong>الرسالة:</strong></p><p>${message.replace(/\n/g, "<br>")}</p><hr><p><a href="${process.env.DASHBOARD_URL || '#'}">عرض في لوحة التحكم</a></p></div>`
      }).catch(e => console.error("Email notify error:", e));
    }
    return res.status(200).json({ success: true, id: ref.id, message: "تم استلام استفسارك بنجاح" });
  } catch (err) {
    console.error("❌ خطأ في /api/inquiry:", err);
    return res.status(500).json({ success: false, message: "حدث خطأ في قاعدة البيانات. الرجاء المحاولة لاحقاً." });
  }
});

app.post("/api/suggestion", async (req, res) => {
  try {
    const { name, contact, message } = req.body;
    if (!name || !contact || !message) return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });

    const suggestionData = {
      name, contact, message, created_at: admin.firestore.FieldValue.serverTimestamp()
    };
    const ref = await firestore().collection("suggestions").add(suggestionData);

    telegramNotify(`💡 اقتراح جديد\nالاسم: ${name}\nوسيلة التواصل: ${contact}\nالاقتراح: ${message.substring(0, 100)}`).catch(e => console.error(e));

    const notifyTo = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    if (notifyTo) {
      transporter.sendMail({
        from: `"اقتراحات الموقع" <${process.env.SMTP_USER}>`,
        to: notifyTo, subject: "💡 اقتراح جديد",
        html: `<div dir="rtl"><h3>اقتراح جديد لتطوير الموقع</h3><p><strong>الاسم:</strong> ${name}</p><p><strong>للتواصل:</strong> ${contact}</p><p><strong>الاقتراح:</strong></p><p>${message.replace(/\n/g, "<br>")}</p></div>`
      }).catch(e => console.error(e));
    }
    return res.status(200).json({ success: true, id: ref.id, message: "شكراً لك! تم استلام اقتراحك" });
  } catch (err) {
    console.error("❌ خطأ في /api/suggestion:", err);
    return res.status(500).json({ success: false, message: "حدث خطأ في الخادم. يرجى المحاولة مرة أخرى." });
  }
});

const lookupRateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

app.get("/api/lookup-player/:uid", async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    if (!lookupRateLimit.has(clientIp)) lookupRateLimit.set(clientIp, []);
    const requestTimes = lookupRateLimit.get(clientIp).filter(time => now - time < RATE_LIMIT_WINDOW);
    if (requestTimes.length >= MAX_REQUESTS_PER_WINDOW) return res.status(429).json({ success: false, message: "طلبات كثيرة جداً. يرجى الانتظار دقيقة." });
    requestTimes.push(now);
    lookupRateLimit.set(clientIp, requestTimes);

    const uid = req.params.uid;
    if (!uid || isNaN(uid) || uid.length < 5) return res.status(400).json({ success: false, message: "يرجى إدخال ID صحيح" });

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) return res.status(500).json({ success: false, message: "خدمة البحث غير مهيأة حالياً" });

    const response = await fetch(`https://id-game-checker.p.rapidapi.com/pubgm-global/${uid}`, {
      method: 'GET', headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'id-game-checker.p.rapidapi.com' }
    });

    const data = await response.json();
    if (data && data.error === false && data.data && data.data.username) {
      return res.json({ success: true, name: data.data.username });
    } else {
      return res.status(404).json({ success: false, message: "لم يتم العثور على اللاعب، تأكد من الـ ID" });
    }
  } catch (error) {
    console.error("Lookup error:", error);
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء الاتصال بالخادم" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "بيانات الدخول مطلوبة" });
    
    if (username !== process.env.ADMIN_USER) {
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    const isMatch = await bcrypt.compare(password, process.env.ADMIN_PASS_HASH);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "بيانات الدخول غير صحيحة" });
    }

    const token = jwt.sign({ role: "admin", u: username }, process.env.ADMIN_JWT_SECRET, { expiresIn: "7d" });
    setAdminCookie(res, token);
    return res.json({ success: true });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ success: false, message: "حدث خطأ أثناء تسجيل الدخول" });
  }
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  res.clearCookie("admin_token");
  res.json({ success: true });
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  try {
    const snap = await firestore().collection("orders").orderBy("created_at", "desc").get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في قاعدة البيانات" });
  }
});

app.get("/api/admin/inquiries", requireAdmin, async (req, res) => {
  try {
    const snap = await firestore().collection("inquiries").orderBy("created_at", "desc").get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في قاعدة البيانات" });
  }
});

app.get("/api/admin/suggestions", requireAdmin, async (req, res) => {
  try {
    const snap = await firestore().collection("suggestions").orderBy("created_at", "desc").get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في قاعدة البيانات" });
  }
});

app.get("/api/admin/messages", requireAdmin, async (req, res) => {
  try {
    const snap = await firestore().collection("messages").orderBy("sent_at", "desc").get();
    const messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "فشل جلب الرسائل" });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const snap = await firestore().collection("users").orderBy("createdAt", "desc").get();
    const users = snap.docs.map((d) => {
      const u = d.data();
      let createdAt = null, lastLoginAt = null;
      if (u.createdAt && u.createdAt.toDate) createdAt = u.createdAt.toDate().toISOString();
      if (u.lastLoginAt && u.lastLoginAt.toDate) lastLoginAt = u.lastLoginAt.toDate().toISOString();
      return {
        id: d.id, name: u.name || null, email: u.email || null, baseId: u.baseId || null,
        role: u.role || "user", isActive: u.isActive !== false,
        loginCount: u.loginCount || 0, createdAt, lastLoginAt
      };
    });
    res.json({ success: true, data: users });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في جلب المستخدمين" });
  }
});

app.get("/api/admin/login-logs", requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const snap = await firestore().collection("login_logs").orderBy("createdAt", "desc").limit(limit).get();
    const logs = snap.docs.map((d) => {
      const l = d.data();
      let createdAt = null;
      if (l.createdAt && l.createdAt.toDate) createdAt = l.createdAt.toDate().toISOString();
      return {
        id: d.id, userId: l.userId || null, name: l.name || null, email: l.email || null,
        event: l.event || "login", success: !!l.success, reason: l.reason || null,
        ip: l.ip || null, userAgent: l.userAgent || null, createdAt
      };
    });
    res.json({ success: true, data: logs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في جلب سجل الدخول" });
  }
});

app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await firestore().collection("users").doc(id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    const u = doc.data();

    const ordersSnap = await firestore().collection("orders").where("userId", "==", id).get();
    const orders = ordersSnap.docs.map(o => ({ id: o.id, ...o.data() }));

    let createdAt = null, lastLoginAt = null;
    if (u.createdAt && u.createdAt.toDate) createdAt = u.createdAt.toDate().toISOString();
    if (u.lastLoginAt && u.lastLoginAt.toDate) lastLoginAt = u.lastLoginAt.toDate().toISOString();

    res.json({
      success: true,
      data: {
        id: doc.id, name: u.name || null, email: u.email || null, baseId: u.baseId || null,
        role: u.role || "user", isActive: u.isActive !== false, loginCount: u.loginCount || 0,
        createdAt, lastLoginAt, orders
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في جلب بيانات المستخدم" });
  }
});

app.post("/api/admin/update-status", requireAdmin, async (req, res) => {
  try {
    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ success: false, message: "معرّف الطلب والحالة مطلوبان" });
    await firestore().collection("orders").doc(id).update({ status });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء التحديث" });
  }
});

app.delete("/api/admin/delete-order", requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "معرّف الطلب مطلوب" });
    await firestore().collection("orders").doc(id).delete();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء الحذف" });
  }
});

app.delete("/api/admin/delete-inquiry", requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "معرّف الاستفسار مطلوب" });
    await firestore().collection("inquiries").doc(id).delete();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء الحذف" });
  }
});

app.delete("/api/admin/delete-suggestion", requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "معرّف الاقتراح مطلوب" });
    await firestore().collection("suggestions").doc(id).delete();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء الحذف" });
  }
});

app.delete("/api/admin/delete-message", requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: "معرّف الرسالة مطلوب" });
    await firestore().collection("messages").doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "فشل حذف الرسالة" });
  }
});

app.post("/api/admin/reply-inquiry", requireAdmin, async (req, res) => {
  try {
    const { inquiryId, email, message, reply } = req.body;
    if (!inquiryId || !email || !message || !reply) return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });

    await transporter.sendMail({
      from: `"فريق الدعم" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
      to: email, subject: "رد على استفسارك",
      html: `<div dir="rtl"><h2>شكراً لتواصلك معنا</h2><p><strong>استفسارك:</strong></p><p>${message}</p><h3>رد الفريق:</h3><p>${reply}</p><p>مع تحيات فريق الدعم</p></div>`
    });
    await firestore().collection("inquiries").doc(inquiryId).update({ status: "تم الرد" });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "فشل إرسال الرد" });
  }
});

app.post("/api/admin/send-message", requireAdmin, async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    if (!email || !subject || !message) return res.status(400).json({ success: false, message: "جميع الحقول مطلوبة" });

    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: "صيغة البريد الإلكتروني غير صحيحة" });

    const messageData = {
      to: email, subject: subject, message: message,
      sent_at: admin.firestore.FieldValue.serverTimestamp(), status: "pending"
    };

    const docRef = await firestore().collection("messages").add(messageData);
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!smtpUser || !smtpPass) {
      await docRef.update({ status: "failed", error: "SMTP configuration missing" });
      return res.status(500).json({ success: false, message: "خادم البريد الإلكتروني غير مهيأ." });
    }

    try {
      const info = await transporter.sendMail({
        from: `"John Store فريق الدعم" <${smtpUser}>`,
        to: email,
        subject: subject,
        attachments: [{
          filename: 'john-store.png',
          path: 'https://i.postimg.cc/x8xtX2KR/john-store.png',
          cid: 'johnstore-logo'
        }],
        html: `
          <div style="font-family: 'Cairo', 'Tajawal', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);" dir="rtl">
            
            <div style="background-color: #1a1a2e; padding: 35px 20px; text-align: center;">
              <img src="cid:johnstore-logo" alt="John Store" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #ffb800; display: inline-block; margin-bottom: 15px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">John <span style="color: #ffb800;">Store</span></h1>
              <p style="color: #a0a0b0; margin: 5px 0 0 0; font-size: 14px;">متجر شحن شدات ببجي</p>
            </div>

            <div style="padding: 30px 20px;">
              <h2 style="color: #333333; margin-top: 0; font-size: 20px; border-bottom: 2px solid #ffb800; padding-bottom: 10px; display: inline-block;">${subject}</h2>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-right: 4px solid #ffb800;">
                <p style="color: #444444; line-height: 1.8; margin: 0; font-size: 16px; white-space: pre-wrap;">
                  ${String(message).replace(/\n/g, "<br>").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </p>
              </div>
            </div>

            <div style="background-color: #f1f3f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #888888; font-size: 13px; margin: 0; line-height: 1.6;">
                هذا البريد إلكتروني آلي، يرجى عدم الرد عليه.<br>
                © ${new Date().getFullYear()} John Store - جميع الحقوق محفوظة.
              </p>
            </div>
            
          </div>
        `,
        text: `John Store\n\nالموضوع: ${subject}\n\n${message}\n\nهذا البريد إلكتروني آلي، يرجى عدم الرد عليه.`
      });
      await docRef.update({ status: "sent", message_id: info.messageId, sent_at: admin.firestore.FieldValue.serverTimestamp() });
      return res.json({ success: true, message: "تم إرسال الرسالة بنجاح", messageId: info.messageId });
    } catch (smtpError) {
      await docRef.update({ status: "failed", error: smtpError.message || "SMTP sending failed" });
      let userMessage = "فشل إرسال الرسالة. ";
      if (smtpError.code === 'EAUTH') userMessage += "خطأ في المصادقة.";
      else if (smtpError.code === 'ESOCKET') userMessage += "مشكلة في الاتصال بالخادم.";
      else userMessage += "يرجى المحاولة مرة أخرى.";
      return res.status(500).json({ success: false, message: userMessage });
    }
  } catch (err) {
    console.error("❌ خطأ في /api/admin/send-message:", err);
    return res.status(500).json({ success: false, message: "حدث خطأ داخلي في الخادم." });
  }
});

app.post("/api/admin/screens", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { targetBaseId, orderId, label } = req.body;
    if (!targetBaseId || !orderId) return res.status(400).json({ success: false, message: "ID المستخدم ورقم الطلب مطلوبان" });
    if (!req.file) return res.status(400).json({ success: false, message: "الصورة مطلوبة" });

    const usersSnap = await firestore().collection("users").where("baseId", "==", targetBaseId).limit(1).get();
    if (usersSnap.empty) return res.status(404).json({ success: false, message: "لا يوجد مستخدم بهذا الـ ID" });

    const imageUrl = await uploadScreenshotToCloudinary(req.file);

    const ref = await firestore().collection("screenshots").add({
      imageUrl, label: label || null, targetBaseId, orderId,
      targetUserId: usersSnap.docs[0].id, uploadedBy: "admin",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, id: ref.id, imageUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "فشل رفع السكرين" });
  }
});

app.get("/api/admin/screens", requireAdmin, async (req, res) => {
  try {
    const snap = await firestore().collection("screenshots").orderBy("createdAt", "desc").get();
    const data = snap.docs.map(d => {
      const s = d.data();
      let createdAt = null;
      if (s.createdAt && s.createdAt.toDate) createdAt = s.createdAt.toDate().toISOString();
      return { id: d.id, imageUrl: s.imageUrl, label: s.label || null, targetBaseId: s.targetBaseId || null, orderId: s.orderId || null, createdAt };
    });
    res.json({ success: true, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "خطأ في جلب السكرينات" });
  }
});

app.delete("/api/admin/screens/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await firestore().collection("screenshots").doc(id).delete();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "فشل حذف السكرين" });
  }
});

function getCouponsCollection() {
  return firestore().collection("coupons");
}

app.post("/api/admin/coupons", requireAdmin, async (req, res) => {
  try {
    const { code, discountPercent, description, expiresAt } = req.body;
    if (!code || !discountPercent) return res.status(400).json({ success: false, message: "كود الخصم ونسبة الخصم مطلوبان" });

    const existing = await getCouponsCollection().where("code", "==", code.toUpperCase()).get();
    if (!existing.empty) return res.status(400).json({ success: false, message: "هذا الكود موجود بالفعل" });

    const couponData = {
      code: code.toUpperCase(), discountPercent: Number(discountPercent), description: description || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(new Date(expiresAt)) : null,
      usedCount: 0, isActive: true
    };
    const ref = await getCouponsCollection().add(couponData);
    res.json({ success: true, id: ref.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/admin/coupons", requireAdmin, async (req, res) => {
  try {
    const snap = await getCouponsCollection().orderBy("createdAt", "desc").get();
    const coupons = snap.docs.map(doc => {
      const data = doc.data();
      let expiryDate = null;
      if (data.expiresAt && data.expiresAt.toDate) expiryDate = data.expiresAt.toDate().toISOString();
      return { id: doc.id, ...data, expiresAt: expiryDate };
    });
    res.json({ success: true, data: coupons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await getCouponsCollection().doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/verify-coupon", async (req, res) => {
  try {
    const { code, originalAmount } = req.body;
    if (!code || !originalAmount) return res.status(400).json({ success: false, message: "الكود والمبلغ مطلوبان" });

    const snap = await getCouponsCollection().where("code", "==", code.toUpperCase()).where("isActive", "==", true).limit(1).get();
    if (snap.empty) return res.status(404).json({ success: false, message: "الكوبون غير صالح أو منتهي الصلاحية" });

    const couponDoc = snap.docs[0];
    const coupon = { id: couponDoc.id, ...couponDoc.data() };
    if (coupon.expiresAt && coupon.expiresAt.toDate && coupon.expiresAt.toDate() < new Date()) {
      return res.status(400).json({ success: false, message: "انتهت صلاحية الكوبون" });
    }

    const discount = (Number(originalAmount) * coupon.discountPercent) / 100;
    const newAmount = Number(originalAmount) - discount;
    res.json({ success: true, discount: discount.toFixed(2), newTotal: newAmount.toFixed(2), discountPercent: coupon.discountPercent, couponCode: coupon.code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/use-coupon", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false });
    const snap = await getCouponsCollection().where("code", "==", code.toUpperCase()).limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.update({ usedCount: admin.firestore.FieldValue.increment(1) });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.post("/api/create-invoice", async (req, res) => {
  try {
    const { orderId, description, amount } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: "رقم الطلب مطلوب" });
    }
    
    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: "المبلغ غير صالح" });
    }

    const response = await fetch(`${process.env.JOHN_PAY_API_URL}/api/v1/invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.JOHN_PAY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId: String(orderId),
        description: String(description || 'طلب من متجر John Store').substring(0, 200),
        amount: Number(amount),
        paymentMethod: 'orange_cash'
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      console.error("John Pay API Error:", data); 
      return res.status(400).json({ success: false, message: data.error || 'فشل إنشاء الفاتورة' });
    }

    res.json({ success: true, checkout_url: data.data.checkout_url, invoice_id: data.data.invoice_id });
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء الاتصال ببوابة الدفع" });
  }
});

app.post("/api/webhook/johnpay", async (req, res) => {
  try {
    const signature = req.headers['x-johnpay-signature'];
    const timestamp = req.headers['x-johnpay-timestamp'];
    const eventId = req.headers['x-johnpay-event-id'];

    if (!signature || !timestamp || !eventId) {
      return res.status(400).json({ error: 'Missing webhook headers' });
    }

    const expectedSignature = crypto.createHmac('sha256', process.env.JOHN_PAY_WEBHOOK_SECRET)
      .update(`${timestamp}.${eventId}.${JSON.stringify(req.body)}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, order_id, invoice_id, transaction_reference } = req.body;

    if (event === 'payment.paid') {
      await firestore().collection('orders').doc(order_id).update({
        status: 'تم الدفع - قيد المراجعة',
        invoiceId: invoice_id,
        transactionId: transaction_reference || null,
        payment_confirmed_at: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await telegramNotify(`💰 تم استلام دفعة ناجحة عبر JOHN PAY\nرقم الطلب: ${order_id}\nالمبلغ: ${req.body.amount} ج.م`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = app;
