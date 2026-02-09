import styles from "./SearchField.module.css";
import { Search } from "lucide-react";

function SearchField({searchTerm, setSearchTerm, placeholder}) {
    return (
        <div className={styles.searchSection}>
            <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} />
                <input type="text" placeholder={placeholder} className={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>
    );
}

export default SearchField;