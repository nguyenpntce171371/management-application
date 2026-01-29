import { Link } from "react-router-dom";
import styles from "./UnauthorizedPage.module.css";

function UnauthorizedPage() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.errorCode}>403</div>
                <h1 className={styles.title}>Không có quyền truy cập</h1>
                <p className={styles.description}>
                    Bạn không có quyền truy cập vào trang này.
                </p>
                <Link to="/" className={styles.homeButton}>
                    Về trang chủ
                </Link>
            </div>
        </div>
    );
}

export default UnauthorizedPage;