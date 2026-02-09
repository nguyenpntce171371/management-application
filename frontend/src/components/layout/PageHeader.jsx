import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import styles from "./PageHeader.module.css";

function PageHeader({ title, back }) {
    const navigate = useNavigate();
    const [displayedText, setDisplayedText] = useState("");
    const charIndexRef = useRef(0);
    const cursorRef = useRef(null);
    const titleCharsRef = useRef([]);

    useEffect(() => {
        if (!title) return;

        titleCharsRef.current = Array.from(title);
        charIndexRef.current = 0;
        setDisplayedText("");

        const typingSpeed = 45;
        let timeout;

        const type = () => {
            if (charIndexRef.current < titleCharsRef.current.length) {
                const currentChar = titleCharsRef.current[charIndexRef.current];

                setDisplayedText(prev => prev + currentChar);
                charIndexRef.current += 1;
                timeout = setTimeout(type, typingSpeed);
            }
        };

        type();

        return () => clearTimeout(timeout);
    }, [title]);

    useEffect(() => {
        if (!cursorRef.current) return;

        gsap.to(cursorRef.current, {
            opacity: 0,
            duration: 0.5,
            repeat: -1,
            yoyo: true,
            ease: "power2.inOut"
        });
    }, []);

    return (
        <header className={styles.header}>
            {back && (
                <button className={styles.backButton} onClick={() => navigate(-1)}>
                    <ChevronLeft />
                    <span>Quay lại</span>
                </button>
            )}
            <h1 className={styles.headerTitle}>
                {displayedText}
                <span ref={cursorRef} className={styles.cursor}>_</span>
            </h1>
        </header>
    );
}

export default PageHeader;