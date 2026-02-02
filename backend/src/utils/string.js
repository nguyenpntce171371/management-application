export function removePrefix(str) {
    if (!str) return "";
    return str?.replace(/^(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn|Đường|Đ\.|Đg|Street)\s+/i, "").trim() || "";
}

export function normalize(str) {
    if (!str) return "";
    const cleaned = removePrefix(str);
    return cleaned?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim() || "";
}