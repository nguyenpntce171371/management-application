import { useState } from "react";
import { User, ArrowLeft, Check, Shield } from "lucide-react";
import styles from "./AuthForm.module.css";
import RegisterStep1 from "../../components/form/RegisterStep1";
import RegisterStep2 from "../../components/form/RegisterStep2";
import RegisterStep3 from "../../components/form/RegisterStep3";
import { Link } from "react-router-dom";

function Register() {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    return (
        <>
            {currentStep === 3 ? (<RegisterStep3 />) : (
                <div className={`${styles.container} ${styles.registerPage}`}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <div className={styles.logoSection}>
                                <div className={styles.logo}>
                                    <div className={styles.logoInner}>
                                        <div className={styles.logoIcon}>R</div>
                                    </div>
                                </div>
                                <h1 className={styles.title}>Tạo Tài Khoản Mới</h1>
                                <p className={styles.subtitle}>
                                    Tham gia hệ thống quản lý bất động sản
                                </p>
                            </div>

                            <div className={styles.stepIndicator}>
                                <div className={styles.stepWrapper}>
                                    <div className={`${styles.stepItem} ${(currentStep === 1) ? styles.stepActive : ""} ${(currentStep > 1) ? styles.stepCompleted : ""}`}>
                                        <div className={styles.stepIconWrapper}>
                                            {(currentStep > 1) ? (<Check className={styles.stepIcon} />) : (<User className={styles.stepIcon} />)}
                                        </div>
                                        <div className={styles.stepInfo}>
                                            <div className={styles.stepTitle}>Thông Tin Tài Khoản</div>
                                            <div className={styles.stepDescription}>Điền thông tin cá nhân</div>
                                        </div>
                                    </div>
                                    <div className={`${styles.stepLine} ${(currentStep > 1) ? styles.stepLineCompleted : ""}`} />
                                </div>

                                <div className={styles.stepWrapper}>
                                    <div className={`${styles.stepItem} ${(currentStep === 2) ? styles.stepActive : ""}`}>
                                        <div className={styles.stepIconWrapper}>
                                            <Shield className={styles.stepIcon} />
                                        </div>
                                        <div className={styles.stepInfo}>
                                            <div className={styles.stepTitle}>Xác Thực Email</div>
                                            <div className={styles.stepDescription}>Nhập mã OTP đã gửi</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.cardBody}>
                            {currentStep === 1 && <RegisterStep1 formData={formData} setFormData={setFormData} setCurrentStep={setCurrentStep} />}

                            {currentStep === 2 && <RegisterStep2 formData={formData} currentStep={currentStep} setCurrentStep={setCurrentStep} />}
                        </div>

                        <div className={styles.cardFooter}>
                            <p className={styles.footerText}>Đã có tài khoản?</p>
                            <Link to ="/login" className={styles.backToLoginButton}>
                                <ArrowLeft className={styles.footerIcon} />
                                Đăng nhập ngay
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Register;