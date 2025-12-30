import { Bell, Calendar, Search, Settings, ChevronLeft } from "lucide-react";
import styles from "./PageHeader.module.css";
import { useNavigate } from "react-router-dom";

function PageHeader({ title, back }) {
    const navigate = useNavigate();
    function getTodayFormat() {
        const now = new Date();

        const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(now);
        const date = now.toLocaleDateString("vi-VN");
        const weekdayFormatted = weekday.charAt(0).toUpperCase() + weekday.slice(1);

        return `Hôm nay, ${weekdayFormatted} - ${date}`;
    }

    return (
        <header className={styles.header}>
            <div className={styles.leftGroup}>
                {back && (
                    <button className={styles.backButton} onClick={() => navigate(-1)}>
                        <ChevronLeft />
                        <span>Quay lại</span>
                    </button>
                )}

                <div className={styles.titleGroup}>
                    <h1 className={styles.headerTitle}>{title}</h1>
                    <p className={styles.headerSubtitle}>
                        <Calendar className={styles.headerIcon} />
                        {getTodayFormat()}
                    </p>
                </div>
            </div>
        </header>
    );
}

export default PageHeader;
