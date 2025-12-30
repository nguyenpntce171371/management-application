import { Link } from "react-router-dom";
import styles from "./StatsCard.module.css";

function StatsCard({ title, value, Icon, colorKey, iconColorKey, route }) {

    return (
        <div className={`${styles.statCard} ${styles[colorKey]}`}>
            <div className={styles.statCardTop}>
                <div className={styles.statInfo}>
                    <p className={styles.statTitle}>{title}</p>
                    <h2 className={styles.statValue}>{value}</h2>
                </div>

                <Link to={route} className={`${styles.statIcon} ${styles[iconColorKey]}`}>
                    <Icon className={styles.statIconSvg} />
                </Link>
            </div>
        </div>
    );
}

export default StatsCard;
