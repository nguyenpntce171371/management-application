import { useEffect, useRef, useState } from "react";
import styles from "../../pages/auth/AuthForm.module.css";
import { Shield, ArrowLeft, Check } from "lucide-react";
import axiosInstance from "../../services/axiosInstance";

function RegisterStep2({ formData, currentStep, setCurrentStep }) {
    const [isLoading, setIsLoading] = useState(false);
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const cooldownRef = useRef(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (resendCooldown > 0) {
            cooldownRef.current = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
        }
        return () => clearTimeout(cooldownRef.current);
    }, [resendCooldown]);

    const startCooldown = (seconds = 60) => {
        setResendCooldown(seconds);
    };


    const handleOtpChange = (index, value) => {
        if (value.length > 1) return;
        if (value && !/^\d+$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        axiosInstance.post("/api/auth/verify-otp-register", { email: formData.email, otp: otp.join("") })
            .then(() => {
                axiosInstance.post("/api/auth/register", { fullName: formData.fullName, email: formData.email, password: formData.password })
                    .then(() => { setCurrentStep(3) })
            })
            .finally(() => { setIsLoading(false); });
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handlePasteOtp = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").trim();
        const digits = pasted.replace(/\D/g, "").slice(0, 6);
        if (!digits) return;
        const newOtp = digits.split("");
        while (newOtp.length < 6) newOtp.push("");
        setOtp(newOtp);
        const lastIndex = newOtp.findLastIndex((v) => v !== "");
        const next = document.getElementById(`otp-${lastIndex}`);
        next?.focus();
    };

    const handleResendOTP = async (e) => {
        e.preventDefault();
        if (resendCooldown > 0) return;
        setIsLoading(true);
        axiosInstance.post("/api/auth/send-otp-register", { email: formData.email }).then(() => startCooldown(60)).finally(() => { setIsLoading(false) });
    };

    return (
        <form onSubmit={handleOtpSubmit} className={styles.form}>
            <div className={styles.formGroup}>
                <label className={styles.label}>
                    <Shield className={styles.labelIcon} />
                    Mã Xác Thực OTP
                </label>
                <div className={styles.otpContainer}>
                    {otp.map((digit, index) => (<input key={index} id={`otp-${index}`} type="text" maxLength={1} className={styles.otpInput} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(index, e)} onPaste={(e) => handlePasteOtp(e)} disabled={isLoading} />))}
                </div>
            </div>

            <div className={styles.infoBox}>
                <div className={styles.infoIcon}><Shield /></div>
                <div className={styles.infoText}>
                    Mã OTP đã được gửi đến <strong>{formData.email}</strong>. Vui
                    lòng kiểm tra hộp thư đến hoặc thư spam. Mã có hiệu lực trong 5
                    phút.
                </div>
            </div>

            <div className={styles.resendSection}>
                <span className={styles.resendText}>Không nhận được mã?</span>
                <button type="button" className={styles.resendButton} onClick={handleResendOTP} disabled={resendCooldown == 0}>Gửi lại</button>
            </div>

            <div className={styles.buttonGroup}>
                <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={isLoading}>
                    <ArrowLeft className={styles.buttonIcon} />
                    Quay lại
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                    Xác thực
                    <Check className={styles.buttonIcon} />
                </button>
            </div>
        </form>
    )
}

export default RegisterStep2;