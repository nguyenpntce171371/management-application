import { useState } from "react";
import { Mail, ArrowLeft, Check, Shield, KeyRound } from "lucide-react";
import styles from "./AuthForm.module.css";
import ForgotPasswordStep1 from "../../components/form/ForgotPasswordStep1";
import ForgotPasswordStep2 from "../../components/form/ForgotPasswordStep2";
import ForgotPasswordStep3 from "../../components/form/ForgotPasswordStep3";
import { Link } from "react-router-dom";

function ForgotPassword() {
    const [currentStep, setCurrentStep] = useState(1);
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);

    const steps = [
        {
            number: 1,
            title: "Nhập Email",
            description: "Nhập email để nhận mã OTP",
            icon: Mail,
        },
        {
            number: 2,
            title: "Xác Thực OTP",
            description: "Nhập mã OTP đã gửi",
            icon: Shield,
        },
        {
            number: 3,
            title: "Đặt Lại Mật Khẩu",
            description: "Tạo mật khẩu mới",
            icon: KeyRound,
        },
    ];

    return (
        <div className={`${styles.container} ${styles.forgotPasswordPage}`}>
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.logoSection}>
                        <div className={styles.logo}>
                            <div className={styles.logoInner}>
                                <div className={styles.logoIcon}>F</div>
                            </div>
                        </div>
                        <h1 className={styles.title}>Quên Mật Khẩu</h1>
                        <p className={styles.subtitle}>
                            Đặt lại mật khẩu của bạn trong 3 bước đơn giản
                        </p>
                    </div>

                    <div className={styles.stepIndicator}>
                        {steps.map((step, index) => {
                            const StepIcon = step.icon;
                            const isActive = currentStep === step.number;
                            const isCompleted = currentStep > step.number;

                            return (
                                <div key={step.number} className={styles.stepWrapper}>
                                    <div className={`${styles.stepItem} ${isActive ? styles.stepActive : ""} ${isCompleted ? styles.stepCompleted : ""}`}>
                                        <div className={styles.stepIconWrapper}>
                                            {isCompleted ? (<Check className={styles.stepIcon} />) : (<StepIcon className={styles.stepIcon} />)}
                                        </div>
                                        <div className={styles.stepInfo}>
                                            <div className={styles.stepTitle}>{step.title}</div>
                                            <div className={styles.stepDescription}>
                                                {step.description}
                                            </div>
                                        </div>
                                    </div>
                                    {index < steps.length - 1 && (<div className={`${styles.stepLine} ${isCompleted ? styles.stepLineCompleted : ""}`} />)}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.cardBody}>
                    {currentStep === 1 && (
                        <ForgotPasswordStep1 email={email} setEmail={setEmail} setCurrentStep={setCurrentStep} />
                    )}

                    {currentStep === 2 && (
                        <ForgotPasswordStep2 email={email} otp={otp} setOtp={setOtp} currentStep={currentStep} setCurrentStep={setCurrentStep} />
                    )}

                    {currentStep === 3 && (
                        <ForgotPasswordStep3 email={email} otp={otp} setOtp={setOtp} currentStep={currentStep} setCurrentStep={setCurrentStep} />
                    )}
                </div>

                <div className={styles.cardFooter}>
                    <Link to="/login" className={styles.backToLoginButton}>
                        <ArrowLeft className={styles.footerIcon} />
                        Quay lại đăng nhập
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;