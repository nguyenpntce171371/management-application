import { useEffect, useState } from "react";
import { formatNumber, NumberInput, PercentInput } from "../../hooks/useNumberFormat";
import styles from "./AppraisalWorksheet.module.css";
import { Plus, X } from 'lucide-react';

function TotalSheet({ appraisalProperties, constructionWorks, addConstruction, deleteConstruction, handleConstructionChange }) {
    const [totalLand, setTotalLand] = useState(0);
    const [totalConstruction, setTotalConstruction] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        let landSum = 0;
        let constructionSum = 0;

        appraisalProperties?.forEach(appraisal => {
            appraisal.land?.forEach(item => {
                const price = appraisal.land?.[0].landType === item.landType ? appraisal.guidedPriceAverage : appraisal.guidedPriceAverage + Number(item.ontLandPrice) - Number(appraisal.land?.[0].ontLandPrice);
                landSum += Math.round(price / 1000) * 1000 * item.landArea;
            });
        });

        constructionWorks?.forEach(w => {
            const money = w.area * w.unitPrice * parseFloat(w.qualityRemaining || 0) / 100;
            constructionSum += money;
        });

        setTotalLand(landSum);
        setTotalConstruction(constructionSum);
        setTotal(landSum + constructionSum);
    }, [appraisalProperties, constructionWorks]);

    return (
        <div className={styles.tableContainer}>
            <table className={styles.comparisonTable}>
                <thead>
                    <tr><th colSpan={6}>KẾT QUẢ THẨM ĐỊNH GIÁ</th></tr>
                    <tr>
                        <th>STT</th>
                        <th>Tên tài sản</th>
                        <th>Loại đất/CLCL (%)</th>
                        <th>Diện tích (m2)</th>
                        <th>Đơn giá (VND/m2)</th>
                        <th>Thành tiền (VND)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>I</td>
                        <td colSpan={4} style={{ fontWeight: "bold" }}>GIÁ TRỊ QUYỀN SỬ DỤNG ĐẤT</td>
                        <td>{formatNumber(totalLand)}</td>
                    </tr>
                    {(() => {
                        let counter = 1;
                        return appraisalProperties?.flatMap((appraisal, i) =>
                            appraisal.land?.map((item, index) => (
                                <tr key={`${i}-${index}`}>
                                    <td>1.{counter++}</td>
                                    <td>{appraisal.location?.landParcel || ""}</td>
                                    <td>{item.landType}</td>
                                    <td>{formatNumber(item.landArea)}</td>
                                    <td>{appraisal.land?.[0].landType === item.landType ? formatNumber(appraisal.guidedPriceAverage, 3) : formatNumber(Number(appraisal.guidedPriceAverage) + Number(item.ontLandPrice) - Number(appraisal.land?.[0].ontLandPrice), 3)}</td>
                                    <td>{appraisal.land?.[0].landType === item.landType ? formatNumber(Math.round(Number(appraisal.guidedPriceAverage) / 1000) * 1000 * Number(item.landArea))
                                        : formatNumber((Math.round(Number(appraisal.guidedPriceAverage) / 1000) * 1000 + Number(item.ontLandPrice) - Number(appraisal.land?.[0].ontLandPrice)) * Number(item.landArea))}</td>
                                </tr>
                            ))
                        );
                    })()}

                    {(() => {
                        if (appraisalProperties?.some(app => (app.currentUsageStatus && app.currentUsageStatus !== "Đất trống"))) {
                            return (
                                <>
                                    <tr>
                                        <td style={{ fontWeight: "bold" }}>II</td>
                                        <td colSpan={4} style={{ fontWeight: "bold" }} className={styles.cellWithButtons}>
                                            GIÁ TRỊ CÔNG TRÌNH XÂY DỰNG TRÊN ĐẤT
                                            <div className={styles.addButtonsContainer}>
                                                <button onClick={addConstruction} className={styles.addConstructionButton} type="button">
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </td>
                                        <td>{formatNumber(totalConstruction)}</td>
                                    </tr>
                                    {constructionWorks?.map((w, index) => (
                                        <tr key={w.id}>
                                            <td >2.{index + 1}</td>
                                            <td className={styles.editableCell}>
                                                <textarea type="text" className={styles.cellInput} value={w.description || ""} onChange={e => handleConstructionChange(w.id, "description", e.target.value)} rows={2} />
                                            </td>
                                            <td>
                                                <PercentInput className={styles.cellInput} value={w.qualityRemaining || ""} onChange={value => handleConstructionChange(w.id, "qualityRemaining", value)} />
                                            </td>
                                            <td>
                                                <NumberInput className={styles.cellInput} value={w.area || ""} onChange={value => handleConstructionChange(w.id, "area", value)} />
                                            </td>
                                            <td>
                                                <NumberInput className={styles.cellInput} value={w.unitPrice || ""} onChange={value => handleConstructionChange(w.id, "unitPrice", value)} />
                                            </td>
                                            <td className={styles.cellWithButtons}>
                                                {formatNumber(w.area * w.unitPrice * parseFloat(w.qualityRemaining) / 100) || ""}
                                                <div className={styles.deleteButtonsContainer}>
                                                    <button onClick={() => deleteConstruction(w.id)} className={styles.deleteConstructionButton} type="button" title="Xóa công trình">
                                                        <X size={16} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            );
                        }
                    })()}
                    <tr>
                        <td colSpan={5} style={{ fontWeight: "bold" }}>
                            Tổng cộng{constructionWorks.length > 0 ? " (I+II)" : ""}
                        </td>
                        <td>{formatNumber(total)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default TotalSheet;