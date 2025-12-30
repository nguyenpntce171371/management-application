import { createRequire } from "module";
const require = createRequire(import.meta.url);
const addressDB = require("../data/address.json");

let provinces = [];
let wards = [];
let wardMappings = [];

addressDB.forEach(item => {
    if (item.type === "table") {
        if (item.name === "provinces") provinces = item.data;
        else if (item.name === "wards") wards = item.data;
        else if (item.name === "ward_mappings") wardMappings = item.data;
    }
});

function normalizeString(str) {
    if (!str) return "";
    return str
        .replace(/^\s*(Tỉnh|Thành phố|Quận|Huyện|Thị xã|Phường|Xã|Thị trấn)\s+/gi, "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function convert(address) {
    try {
        if (!address || typeof address !== "string") {
            return address;
        }

        const parts = address.split(",").map(p => p.trim()).filter(p => p);

        if (parts.length < 3) {
            return address;
        }

        const [wardPart, districtPart, provincePart] = parts.slice(-3);
        const normalizedProvince = normalizeString(provincePart);
        const normalizedDistrict = normalizeString(districtPart);
        const normalizedWard = normalizeString(wardPart);

        const mapping = wardMappings.find(m => {
            const matchProvince = normalizeString(m.old_province_name) === normalizedProvince;
            const matchDistrict = normalizeString(m.old_district_name) === normalizedDistrict;
            const matchWard = normalizeString(m.old_ward_name) === normalizedWard;

            return matchProvince && matchDistrict && matchWard;
        });

        if (!mapping) {
            const province = provinces.find(p => normalizeString(p.name) === normalizedProvince);

            if (!province) {
                return address;
            }

            const ward = wards.find(w =>
                w.province_code === province.province_code &&
                normalizeString(w.name) === normalizedWard
            );

            if (!ward) {
                return address;
            }

            return address;
        }

        const newAddress = `${mapping.new_ward_name}, ${mapping.new_province_name}`;
        return newAddress;

    } catch (error) {
        console.error("Address conversion error:", error);
        return address;
    }
}

export default convert;