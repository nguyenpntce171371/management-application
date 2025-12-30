import styles from "./Layout.module.css";
import Sidebar from "../components/sidebar/Sidebar";

function Layout({ children }) {
    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>
                <Sidebar />
            </aside>
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}

export default Layout;