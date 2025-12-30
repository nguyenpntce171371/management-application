import { Link } from "react-router-dom";
import styles from "./NotFound.module.css";

function NotFound() {

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.errorCode}>404</div>
                <h1 className={styles.title}>Trang không tồn tại</h1>
                <p className={styles.description}>
                    Rất tiếc, trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
                </p>
                <Link to="/" className={styles.homeButton}>
                    Quay về trang chủ
                </Link>
            </div>
        </div>
    );
}

export default NotFound;
