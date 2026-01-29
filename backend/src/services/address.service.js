import { createRequire } from "module";
import { normalize } from "../utils/string";
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
        const normalizedProvince = normalize(provincePart);
        const normalizedDistrict = normalize(districtPart);
        const normalizedWard = normalize(wardPart);

        const mapping = wardMappings.find(m => {
            const matchProvince = normalize(m.old_province_name) === normalizedProvince;
            const matchDistrict = normalize(m.old_district_name) === normalizedDistrict;
            const matchWard = normalize(m.old_ward_name) === normalizedWard;

            return matchProvince && matchDistrict && matchWard;
        });

        if (!mapping) {
            const province = provinces.find(p => normalize(p.name) === normalizedProvince);

            if (!province) {
                return address;
            }

            const ward = wards.find(w =>
                w.province_code === province.province_code &&
                normalize(w.name) === normalizedWard
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