import { useEffect, useState } from "react";

export const useNumberFormat = (initialValue = "", roundOnBlur = false) => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
        setDisplayValue(roundOnBlur ? formatNumber(initialValue) : formatNumberWithDecimal(initialValue));
    }, []);

    const handleChange = (e, onChange) => {
        const input = e.target.value;
        const rawValue = input.replace(/,/g, "");

        if (rawValue === "" || /^\d*\.?\d*$/.test(rawValue)) {
            if (rawValue.endsWith(".") || (rawValue.includes(".") && rawValue.split(".")[1]?.length > 0)) {
                setDisplayValue(formatNumberWithDecimal(rawValue));
            } else {
                setDisplayValue(formatNumberWithDecimal(rawValue));
            }
            onChange(rawValue);
        }
    };

    const handleBlur = (value) => {
        const rawValue = String(value).replace(/,/g, "");
        setDisplayValue(roundOnBlur ? formatNumber(rawValue) : formatNumberWithDecimal(rawValue));
    };

    return { displayValue, handleChange, handleBlur, setDisplayValue };
};

export const formatNumber = (value, rounded = 0) => {
    if (value === null || value === undefined || value === "") return "";

    const cleanValue = String(value).replace(/,/g, "");
    let numValue = Number(cleanValue);
    if (isNaN(numValue)) return "";

    if (rounded > 0) {
        const factor = 10 ** rounded;
        numValue = Math.round(numValue / factor) * factor;
    } else {
        numValue = Math.round(numValue);
    }

    const stringValue = String(numValue);

    if (/^0\d{8,10}$/.test(stringValue)) {
        return stringValue;
    }

    const formattedInteger = stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return formattedInteger;
};

export const formatNumberWithDecimal = (value) => {
    if (!value && value !== 0) return "";

    const stringValue = String(value).replace(/,/g, "");

    if (stringValue.includes(".")) {
        const [integerPart, decimalPart] = stringValue.split(".");

        if (/^0\d{8,10}$/.test(integerPart)) {
            return stringValue;
        }

        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : `${formattedInteger}.`;
    }

    const numValue = Number(stringValue);
    if (isNaN(numValue)) return "";

    if (/^0\d{8,10}$/.test(stringValue)) {
        return stringValue;
    }

    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const NumberInput = ({ value, onChange, className, placeholder, roundOnBlur = false, ...props }) => {
    const { displayValue, handleChange, handleBlur, setDisplayValue } = useNumberFormat(value, roundOnBlur);

    useEffect(() => {
        const rawValue = String(value || "").replace(/,/g, "");
        setDisplayValue(roundOnBlur ? formatNumber(rawValue) : formatNumberWithDecimal(rawValue));
    }, [value, setDisplayValue, roundOnBlur]);

    return (
        <input type="text" className={className} placeholder={placeholder} value={displayValue} onChange={(e) => handleChange(e, onChange)} onBlur={() => handleBlur(value)}            {...props} />
    );
};

export const usePercentFormat = (initialValue = "") => {
    const [displayValue, setDisplayValue] = useState("");

    useEffect(() => {
        setDisplayValue(initialValue || "");
    }, [initialValue]);

    const handleChange = (e, onChange) => {
        let input = e.target.value;
        let raw = input.replace(/[^0-9.-]/g, "");
        const parts = raw.split(".");
        if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
        if (raw === "-" || raw === "") {
            setDisplayValue(raw);
            onChange(raw);
            return;
        }
        const finalDisplay = raw.endsWith("%") ? raw : raw + "%";
        setDisplayValue(finalDisplay);
        onChange(finalDisplay);
    };

    const handleBlur = (value) => {
        if (!value) {
            setDisplayValue("");
        } else if (value === "-") {
            setDisplayValue("-");
        } else {
            const raw = value.replace(/%/g, "");
            setDisplayValue(raw + "%");
        }
    };

    return { displayValue, handleChange, handleBlur, setDisplayValue };
};

export const formatPercent = (value, decimals = 2) => {
    if (value === null || value === undefined || value === "") return "";
    let num = parseFloat(String(value).replace(/%/g, ""));
    if (isNaN(num)) return "";
    return `${num.toFixed(decimals)}%`;
};

export const PercentInput = ({ value, onChange, className, placeholder, ...props }) => {
    const { displayValue, handleChange, handleBlur, setDisplayValue } = usePercentFormat(value);

    useEffect(() => {
        setDisplayValue(value || "");
    }, [value, setDisplayValue]);

    return (
        <input type="text" className={className} placeholder={placeholder} value={displayValue} onChange={(e) => handleChange(e, onChange)} onBlur={() => handleBlur(value)}            {...props} />
    );
};