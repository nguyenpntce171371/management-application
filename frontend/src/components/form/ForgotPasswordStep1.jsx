import { useState } from "react";
import styles from "../../pages/auth/AuthForm.module.css";
import { Mail, ArrowRight } from "lucide-react";
import axiosInstance from "../../services/axiosInstance";

function ForgotPasswordStep1({ email, setEmail, setCurrentStep }) {
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            notify({
                type: "error",
                title: "Thiếu thông tin",
                message: "Vui lòng điền đầy đủ thông tin.",
            });
            return;
        }

        setIsLoading(true);
        axiosInstance.post("/api/password/send-otp-forgot", { email: email })
            .then(() => { setCurrentStep(2) })
            .finally(() => { setIsLoading(false) });
    };

    return (
        <form onSubmit={handleEmailSubmit} className={styles.form}>
            <div className={styles.formGroup}>
                <label className={styles.label}>
                    <Mail className={styles.labelIcon} />
                    Địa chỉ Email
                </label>
                <div className={styles.inputWrapper}>
                    <input type="email" className={styles.input} placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
                    <Mail className={styles.inputIcon} />
                </div>
            </div>

            <div className={styles.infoBox}>
                <div className={styles.infoIcon}>
                    <Mail />
                </div>
                <div className={styles.infoText}>
                    Chúng tôi sẽ gửi mã OTP đến email của bạn. Vui lòng kiểm tra hộp thư đến hoặc thư spam.
                </div>
            </div>

            <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                Gửi mã OTP
                <ArrowRight className={styles.buttonIcon} />
            </button>
        </form>
    )
}

export default ForgotPasswordStep1;