import { useState } from "react";
import styles from "./Pagination.module.css";
import { ChevronLeft, ChevronRight } from "lucide-react";

function Pagination({ prevCursor, nextCursor, hasPrev, hasMore, setCursor, setDirection }) {
    const [page, setPage] = useState(1);

    const goPrev = () => {
        if (!hasPrev) return;
        setCursor(prevCursor);
        setDirection("prev");
        setPage(p => Math.max(1, p - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goNext = () => {
        if (!hasMore) return;
        setCursor(nextCursor);
        setDirection("next");
        setPage(p => p + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        ((hasPrev || hasMore) && (
            <div className={styles.pagination}>
                <button className={styles.button} disabled={!hasPrev} onClick={goPrev}>
                    <ChevronLeft className={styles.icon} />
                </button>
                <span className={styles.page}>{page}</span>
                <button className={styles.button} disabled={!hasMore} onClick={goNext}>
                    <ChevronRight className={styles.icon} />
                </button>
            </div>
        ))
    );
}

export default Pagination;
