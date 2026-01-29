import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendEmail = async ({ to, subject, html, text }) => {
    const mailOptions = {
        from: `"Your App Name" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        ...(html && { html }),
        ...(text && { text })
    };
    
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Email sending error:", error);
        throw new Error("Không thể gửi email. Vui lòng thử lại sau");
    }
};

const getMinimalStyles = () => `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        line-height: 1.6; 
        color: #1f2937;
        background-color: #f9fafb;
        padding: 40px 20px;
    }
    .email-container {
        max-width: 560px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
        padding: 48px 32px 32px;
        text-align: center;
        background: #ffffff;
        border-bottom: 1px solid #f3f4f6;
    }
    .header-icon {
        width: 56px;
        height: 56px;
        margin: 0 auto 16px;
        background: #f3f4f6;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
    }
    .header h1 {
        font-size: 24px;
        font-weight: 600;
        color: #111827;
        letter-spacing: -0.5px;
    }
    .content {
        padding: 32px;
    }
    .text {
        color: #6b7280;
        font-size: 15px;
        line-height: 1.7;
        margin-bottom: 24px;
    }
    .otp-box {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 32px 24px;
        text-align: center;
        margin: 32px 0;
    }
    .otp-label {
        font-size: 12px;
        font-weight: 500;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
    }
    .otp-code {
        font-size: 40px;
        font-weight: 700;
        color: #111827;
        letter-spacing: 8px;
        font-family: "SF Mono", "Monaco", "Courier New", monospace;
        margin: 12px 0;
    }
    .otp-expiry {
        font-size: 13px;
        color: #6b7280;
        margin-top: 12px;
    }
    .info-box {
        background: #fffbeb;
        border-left: 3px solid #f59e0b;
        padding: 16px 20px;
        border-radius: 4px;
        margin: 24px 0;
    }
    .info-box-title {
        font-size: 14px;
        font-weight: 600;
        color: #92400e;
        margin-bottom: 8px;
    }
    .info-box ul {
        margin: 0;
        padding-left: 18px;
        color: #78350f;
        font-size: 13px;
        line-height: 1.8;
    }
    .alert-box {
        background: #fef2f2;
        border-left: 3px solid #ef4444;
        padding: 16px 20px;
        border-radius: 4px;
        margin: 24px 0;
    }
    .alert-box-title {
        font-size: 14px;
        font-weight: 600;
        color: #991b1b;
        margin-bottom: 8px;
    }
    .alert-box-text {
        color: #7f1d1d;
        font-size: 13px;
        line-height: 1.7;
    }
    .footer {
        padding: 24px 32px;
        background: #f9fafb;
        border-top: 1px solid #f3f4f6;
        text-align: center;
    }
    .footer-text {
        font-size: 12px;
        color: #9ca3af;
        line-height: 1.6;
    }
    .signature {
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid #f3f4f6;
        font-size: 14px;
        color: #6b7280;
    }
    .signature strong {
        color: #111827;
        font-weight: 600;
    }
    .button {
        display: inline-block;
        padding: 12px 24px;
        background: #111827;
        color: #ffffff;
        text-decoration: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        margin: 24px 0;
    }
`;

export const sendOTPRegisterEmail = async (email, otp, expiresIn) => {
    const minutes = Math.floor(expiresIn / 60);
    return await sendEmail({
        to: email,
        subject: "Xác thực tài khoản của bạn",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>${getMinimalStyles()}</style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="header-icon">🔐</div>
                        <h1>Xác thực tài khoản</h1>
                    </div>
                    
                    <div class="content">
                        <p class="text">
                            Cảm ơn bạn đã đăng ký. Để hoàn tất, vui lòng nhập mã xác thực bên dưới:
                        </p>
                        
                        <div class="otp-box">
                            <div class="otp-label">Mã xác thực</div>
                            <div class="otp-code">${otp}</div>
                            <div class="otp-expiry">Có hiệu lực trong ${minutes} phút</div>
                        </div>
                        
                        <div class="info-box">
                            <div class="info-box-title">Lưu ý bảo mật</div>
                            <ul>
                                <li>Không chia sẻ mã này với bất kỳ ai</li>
                                <li>Mã chỉ sử dụng được một lần duy nhất</li>
                                <li>Bỏ qua email này nếu bạn không yêu cầu</li>
                            </ul>
                        </div>
                        
                        <div class="signature">
                            Trân trọng,<br>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p class="footer-text">
                            Email tự động, vui lòng không trả lời.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};

export const sendOTPResetPasswordEmail = async (email, otp, expiresIn) => {
    const minutes = Math.floor(expiresIn / 60);
    return await sendEmail({
        to: email,
        subject: "Khôi phục mật khẩu",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>${getMinimalStyles()}</style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="header-icon">🔑</div>
                        <h1>Khôi phục mật khẩu</h1>
                    </div>
                    
                    <div class="content">
                        <p class="text">
                            Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. 
                            Sử dụng mã xác thực bên dưới để tiếp tục:
                        </p>
                        
                        <div class="otp-box">
                            <div class="otp-label">Mã xác thực</div>
                            <div class="otp-code">${otp}</div>
                            <div class="otp-expiry">Có hiệu lực trong ${minutes} phút</div>
                        </div>
                        
                        <div class="info-box">
                            <div class="info-box-title">Lưu ý</div>
                            <ul>
                                <li>Không chia sẻ mã này với bất kỳ ai</li>
                                <li>Mã chỉ sử dụng được một lần duy nhất</li>
                                <li>Mã sẽ hết hạn sau ${minutes} phút</li>
                            </ul>
                        </div>
                        
                        <div class="alert-box">
                            <div class="alert-box-title">Không phải bạn?</div>
                            <p class="alert-box-text">
                                Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này 
                                và cân nhắc đổi mật khẩu để bảo vệ tài khoản.
                            </p>
                        </div>
                        
                        <div class="signature">
                            Trân trọng,<br>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p class="footer-text">
                            Email tự động, vui lòng không trả lời.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};

export const sendWelcomeEmail = async (email, fullName) => {
    return await sendEmail({
        to: email,
        subject: `Chào mừng ${fullName}!`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>${getMinimalStyles()}</style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="header-icon">👋</div>
                        <h1>Chào mừng đến với chúng tôi!</h1>
                    </div>
                    
                    <div class="content">
                        <p class="text">
                            Xin chào <strong>${fullName}</strong>,
                        </p>
                        
                        <p class="text">
                            Cảm ơn bạn đã đăng ký. Chúng tôi rất vui được chào đón bạn. 
                            Tài khoản của bạn đã được kích hoạt và sẵn sàng sử dụng.
                        </p>
                        
                        <div style="text-align: center;">
                            <a href="https://${process.env.DOMAIN}" class="button">
                                Bắt đầu
                            </a>
                        </div>
                        
                        <p class="text">
                            Nếu có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với chúng tôi.
                        </p>
                        
                        <div class="signature">
                            Trân trọng,<br>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p class="footer-text">
                            Email tự động, vui lòng không trả lời.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};

export const sendPasswordChangedEmail = async (email, fullName) => {
    const currentTime = new Date().toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
    
    return await sendEmail({
        to: email,
        subject: "Mật khẩu đã được thay đổi",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>${getMinimalStyles()}</style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <div class="header-icon">✓</div>
                        <h1>Mật khẩu đã được cập nhật</h1>
                    </div>
                    
                    <div class="content">
                        <p class="text">
                            Xin chào <strong>${fullName}</strong>,
                        </p>
                        
                        <p class="text">
                            Mật khẩu của bạn đã được thay đổi thành công vào lúc <strong>${currentTime}</strong>.
                        </p>
                        
                        <div class="info-box">
                            <div class="info-box-title">Thông tin</div>
                            <ul>
                                <li>Tất cả phiên đăng nhập khác đã bị đăng xuất</li>
                                <li>Thiết bị hiện tại vẫn duy trì phiên</li>
                            </ul>
                        </div>
                        
                        <div class="alert-box">
                            <div class="alert-box-title">Không phải bạn?</div>
                            <p class="alert-box-text">
                                Nếu bạn không thực hiện thay đổi này, tài khoản của bạn có thể bị xâm nhập. 
                                Vui lòng liên hệ hỗ trợ ngay lập tức và đổi mật khẩu mới.
                            </p>
                        </div>
                        
                        <div class="signature">
                            Trân trọng,<br>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p class="footer-text">
                            Email tự động, vui lòng không trả lời.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    });
};