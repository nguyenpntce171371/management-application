import { useState } from "react";
import { ArrowLeft, ArrowRight, Shield } from "lucide-react";
import styles from "../../pages/auth/AuthForm.module.css";
import axiosInstance from "../../services/axiosInstance";

function ForgotPasswordStep2({ email, otp, setOtp, currentStep, setCurrentStep }) {
    const [isLoading, setIsLoading] = useState(false);

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

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        if (otp.some((digit) => digit === "")) {
            notify({
                type: "error",
                title: "Thiếu OTP",
                message: "Vui lòng điền đầy đủ thông tin OTP.",
            });
            return;
        }
        setIsLoading(true);
        axiosInstance.post("/api/password/verify-otp-forgot", { email: email, otp: otp.join("") })
            .then(() => setCurrentStep(3))
            .finally(() => setIsLoading(false));
    };


    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <form onSubmit={handleOtpSubmit} className={styles.form}>
            <div className={styles.formGroup}>
                <label className={styles.label}>
                    <Shield className={styles.labelIcon} />
                    Mã OTP
                </label>
                <div className={styles.otpContainer}>
                    {otp.map((digit, index) => (<input key={index} id={`otp-${index}`} type="text" maxLength={1} className={styles.otpInput} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(index, e)} onPaste={(e) => handlePasteOtp(e)} disabled={isLoading} />))}
                </div>
            </div>

            <div className={styles.infoBox}>
                <div className={styles.infoIcon}>
                    <Shield />
                </div>
                <div className={styles.infoText}>
                    Mã OTP đã được gửi đến <strong>{email}</strong>. Mã có hiệu lực trong 5 phút.
                </div>
            </div>

            <div className={styles.resendSection}>
                <span className={styles.resendText}>Không nhận được mã?</span>
                <button type="button" className={styles.resendButton}>
                    Gửi lại
                </button>
            </div>

            <div className={styles.buttonGroup}>
                <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={isLoading}>
                    <ArrowLeft className={styles.buttonIcon} />
                    Quay lại
                </button>
                <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                    Xác thực
                    <ArrowRight className={styles.buttonIcon} />
                </button>
            </div>
        </form>
    )
}

export default ForgotPasswordStep2;