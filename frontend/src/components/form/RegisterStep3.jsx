import { CheckCircle2, Check } from "lucide-react";
import styles from "../../pages/auth/AuthForm.module.css";
import { Link } from "react-router-dom";

function RegisterStep3() {
    return (
        <div className={styles.container}>
            <div className={styles.successCard}>
                <div className={styles.successIconWrapper}>
                    <div className={styles.successIconCircle}>
                        <CheckCircle2 className={styles.successIcon} />
                    </div>
                    <div className={styles.successRipple}></div>
                    <div className={styles.successRipple} style={{ animationDelay: "0.5s" }}></div>
                </div>
                <h1 className={styles.successTitle}>Đăng Ký Thành Công! 🎉</h1>
                <p className={styles.successDescription}>
                    Tài khoản của bạn đã được tạo thành công. Chào mừng bạn đến với hệ thống quản lý
                    bất động sản.
                </p>
                <Link to="/login" className={styles.successButton}>
                    <Check className={styles.buttonIcon} />
                    Đăng Nhập Ngay
                </Link>
            </div>
        </div>
    )
}

export default RegisterStep3;