import { ArrowRight, Building2, } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "./HomePage.module.css";

function HomePage() {
    return (
        <div className={styles.container}>
            <nav className={styles.nav}>
                <div className={styles.navContainer}>
                    <div className={styles.navLogo}>
                        <Building2 className={styles.logoIcon} />
                        <span className={styles.logoText}>Name</span>
                    </div>
                    <div className={styles.navLinks}>
                        <Link to="/staff/real-estate" className={styles.navLink}>
                            Bất động sản
                        </Link>
                    </div>
                </div>
            </nav>

            <section className={styles.hero} id="home">
                <div className={styles.heroOverlay} />
                <div className={styles.heroContent}>
                    <div className={styles.heroText}>
                        <h1 className={styles.heroTitle}>
                            Tìm Ngôi Nhà <span className={styles.heroTitleGold}>Hoàn Hảo</span> Của Bạn
                        </h1>
                        <p className={styles.heroSubtitle}>
                            Khám phá nhiều bất động sản cao cấp từ khắp cả nước.
                        </p>
                        <Link className={styles.searchButton} to="/staff/real-estate">
                            Tìm kiếm
                            <ArrowRight className={styles.searchButtonIcon} />
                        </Link>
                    </div>
                </div>
            </section>
            <footer className={styles.footer}>
                <div className={styles.footerContainer}>
                    <p className={styles.footerCopyright}>
                        © 2025 LuxuryEstate. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default HomePage;
