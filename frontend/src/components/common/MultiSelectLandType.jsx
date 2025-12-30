import { useEffect, useRef, useState } from "react";
import styles from "./MultiSelectLandType.module.css";

function MultiSelectLandType({ value = [], list, onChange, onBlur, disabled = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCodes, setSelectedCodes] = useState(value);
    const [searchBuffer, setSearchBuffer] = useState("");
    const searchTimer = useRef(null);
    const dropdownRef = useRef(null);
    const sortedList = [...list].sort((a, b) =>
        a.code.localeCompare(b.code, "en", { sensitivity: "base" })
    );

    useEffect(() => {
        if (!isOpen) return;
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
        const handleKeyDown = (e) => {
            if (!/^[a-zA-Z]$/.test(e.key)) return;

            const nextBuffer = (searchBuffer + e.key).toUpperCase();
            setSearchBuffer(nextBuffer);

            if (searchTimer.current) clearTimeout(searchTimer.current);
            searchTimer.current = setTimeout(() => {
                setSearchBuffer("");
            }, 800);

            const index = sortedList.findIndex(item =>
                item.code.toUpperCase().startsWith(nextBuffer)
            );

            if (index !== -1 && dropdownRef.current) {
                const target = dropdownRef.current.children[index];
                dropdownRef.current.scrollTop = target.offsetTop;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, sortedList, searchBuffer]);

    useEffect(() => {
        setSelectedCodes(value);
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest(`.${styles.multiSelectContainer}`)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggle = (code) => {
        const newSelected = selectedCodes.includes(code) ? selectedCodes.filter(c => c !== code) : [...selectedCodes, code];
        setSelectedCodes(newSelected);
        onChange(newSelected);
    };

    return (
        <div className={styles.multiSelectContainer}>
            <div className={styles.multiSelectTrigger} onClick={() => !disabled && setIsOpen(!isOpen)} style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
                <span className={styles.multiSelectValue}>
                    {selectedCodes.join(" + ") || "Chọn loại đất..."}
                </span>
                <span className={styles.multiSelectArrow}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
                <div className={styles.multiSelectDropdown} ref={dropdownRef}>
                    {sortedList.map(landType => (
                        <label key={landType.code} className={styles.multiSelectOption}>
                            <input type="checkbox" checked={selectedCodes.includes(landType.code)} onChange={() => handleToggle(landType.code)} onBlur={onBlur}/>
                            <span className={styles.multiSelectOptionText}>
                                {landType.code} - {landType.name}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

export default MultiSelectLandType;