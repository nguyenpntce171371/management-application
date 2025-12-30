import React, { useState } from "react";
import styles from "./AppraisalWorksheet.module.css";
import { LAND_TYPE } from "../../config/landTypeConfig";
import MultiSelectLandType from "../common/MultiSelectLandType";
import { NumberInput, PercentInput, formatNumber } from "../../hooks/useNumberFormat";
import { Link } from "react-router-dom";

function BasicSheet({ appraisalData, comparisonsData, handleComparisonChange, handleAppraisalChange, getLandByType }) {
    const [editingId, setEditingIndex] = useState(null);
    const allLandTypes = Array.from(new Set([...(appraisalData.land?.map(l => l.landType) || []), ...comparisonsData.flatMap(c => c.land?.map(l => l.landType) || [])]));
    const baseLandType = appraisalData.land?.[0]?.landType;
    const landTypesToAdjust = Array.from(new Set(comparisonsData.flatMap(c => c.land?.map(l => l.landType) || []))).filter(lt => lt !== baseLandType);
    return (
        <div className={styles.tableContainer}>
            <table className={styles.comparisonTable}>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Yếu tố so sánh</th>
                        <th>TSTĐ</th>
                        {comparisonsData.map((comp, i) => (
                            <th key={comp._id}>
                                <Link to={`/staff/real-estate/${comp.id}`} className={styles.TSSS} target="_blank">
                                    TSSS{i + 1}
                                </Link>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>Thời điểm/Tình trạng giao dịch</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <input type="text" className={styles.cellInput} value={comp.transactionTime || ""} onChange={e => handleComparisonChange(comp._id, "transactionTime", e.target.value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td><i>1.1</i></td>
                        <td>Nguồn</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <input type="text" className={styles.cellInput} value={comp.source || ""} onChange={e => handleComparisonChange(comp._id, "source", e.target.value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td><i>1.2</i></td>
                        <td>Thông tin liên lạc</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id} >
                                <input type="text" className={styles.cellInput} style={{ color: "red" }} value={comp.contactInfo || ""} onChange={e => handleComparisonChange(comp._id, "contactInfo", e.target.value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>Tình trạng pháp lý</td>
                        <td>
                            <input className={styles.cellInput} value={appraisalData.legalStatus || ""} onChange={e => handleAppraisalChange(appraisalData.id, "legalStatus", e.target.value)} />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <input type="text" className={styles.cellInput} value={comp.legalStatus || ""} onChange={e => handleComparisonChange(comp._id, "legalStatus", e.target.value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>3</td>
                        <td>Mục đích sử dụng đất</td>
                        <td style={{ textAlign: "left" }} >
                            <MultiSelectLandType value={appraisalData.land?.map(l => l.landType) || []} list={LAND_TYPE} onChange={(value) => handleAppraisalChange(appraisalData.id, "landTypes", value)} />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id} style={{ textAlign: "left" }}>
                                <MultiSelectLandType value={comp.land?.map(l => l.landType) || []} list={LAND_TYPE} onChange={(value) => handleComparisonChange(comp._id, "landTypes", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td rowSpan={2}>4</td>
                        <td rowSpan={2}>Vị trí</td>
                        <td>
                            <textarea className={styles.cellInput} value={appraisalData.location?.landParcel || ""} onChange={e => handleAppraisalChange(appraisalData.id, "location.landParcel", e.target.value)} rows={3} />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <textarea className={styles.cellInput} value={comp.location?.landParcel || ""} onChange={e => handleComparisonChange(comp._id, "location.landParcel", e.target.value)} rows={3} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>
                            <textarea className={styles.cellInput} value={appraisalData.location?.description || ""} onChange={e => handleAppraisalChange(appraisalData.id, "location.description", e.target.value)} rows={3} />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <textarea className={styles.cellInput} value={comp.location?.description || ""} onChange={e => handleComparisonChange(comp._id, "location.description", e.target.value)} rows={3} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>5</td>
                        <td>Kích thước (m)</td>
                        <td>
                            <div className={styles.dimensionInput}>
                                <NumberInput className={styles.cellInput} value={appraisalData.width || ""} onChange={value => handleAppraisalChange(appraisalData.id, "width", value)} />
                                <span>x</span>
                                <NumberInput className={styles.cellInput} value={appraisalData.length || ""} onChange={value => handleAppraisalChange(appraisalData.id, "length", value)} />
                            </div>
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <div className={styles.dimensionInput}>
                                    <NumberInput className={styles.cellInput} value={comp.width || ""} onChange={value => handleComparisonChange(comp._id, "width", value)} />
                                    <span>x</span>
                                    <NumberInput className={styles.cellInput} value={comp.length || ""} onChange={value => handleComparisonChange(comp._id, "length", value)} />
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>6</td>
                        <td>Lợi thế kinh doanh</td>
                        <td>
                            <input className={styles.cellInput} value={appraisalData.businessAdvantage || ""} onChange={e => handleAppraisalChange(appraisalData.id, "businessAdvantage", e.target.value)} placeholder="Bình thường" />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <input className={styles.cellInput} value={comp.businessAdvantage || ""} onChange={e => handleComparisonChange(comp._id, "businessAdvantage", e.target.value)} placeholder="Bình thường" />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>7</td>
                        <td>Môi trường sống</td>
                        <td>
                            <input className={styles.cellInput} value={appraisalData.livingEnvironment || ""} onChange={e => handleAppraisalChange(appraisalData.id, "livingEnvironment", e.target.value)} placeholder="Bình thường" />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <input className={styles.cellInput} value={comp.livingEnvironment || ""} onChange={e => handleComparisonChange(comp._id, "livingEnvironment", e.target.value)} placeholder="Bình thường" />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>8</td>
                        <td style={{ fontWeight: "bold" }}>Quy mô diện tích (m2)</td>
                        <td>
                            <NumberInput className={styles.cellInput} style={{ fontWeight: "bold" }} value={appraisalData.area || ""} onChange={value => handleAppraisalChange(appraisalData.id, "area", value)} />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <NumberInput className={styles.cellInput} style={{ fontWeight: "bold" }} value={comp.area || ""} onChange={value => handleComparisonChange(comp._id, "area", value)}  />
                            </td>
                        ))}
                    </tr>
                    {allLandTypes.map((landType, idx) => {
                        const appraisalLand = getLandByType(appraisalData.land, landType);
                        return (
                            <tr key={landType}>
                                <td style={{ fontStyle: "italic" }}>8.{idx + 1}</td>
                                <td style={{ fontStyle: "italic" }}>Đất {landType} (m2)</td>
                                <td>
                                    {appraisalLand && (<NumberInput className={styles.cellInput} style={{ fontStyle: "italic" }} value={appraisalLand.landArea || ""} onChange={value => handleAppraisalChange(appraisalData.id, `land.${landType}.landArea`, value)} />)}
                                </td>
                                {comparisonsData.map((comp) => {
                                    const compLand = getLandByType(comp.land, landType);
                                    return (
                                        <td key={comp._id}>
                                            {compLand && (<NumberInput className={styles.cellInput} style={{ fontStyle: "italic" }} value={compLand.landArea || ""} onChange={value => handleComparisonChange(comp._id, `land.${landType}.landArea`, value)} />)}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    <tr>
                        <td>9</td>
                        <td>Cơ sở hạ tầng</td>
                        <td>
                            <input className={styles.cellInput} value={appraisalData.infrastructure || ""} onChange={e => handleAppraisalChange(appraisalData.id, "infrastructure", e.target.value)} placeholder="Hoàn chỉnh" />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <input className={styles.cellInput} value={comp.infrastructure || ""} onChange={e => handleComparisonChange(comp._id, "infrastructure", e.target.value)} placeholder="Hoàn chỉnh" />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>10</td>
                        <td>Hình dáng</td>
                        <td>
                            <input className={styles.cellInput} value={appraisalData.shape || ""} onChange={e => handleAppraisalChange(appraisalData.id, "shape", e.target.value)} placeholder="Cân đối" />
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <input className={styles.cellInput} value={comp.shape || ""} onChange={e => handleComparisonChange(comp._id, "shape", e.target.value)} placeholder="Cân đối" />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>11</td>
                        <td>Hiện trạng sử dụng</td>
                        <td>
                            <div className={styles.cellInput} onClick={() => handleAppraisalChange(appraisalData.id, "currentUsageStatus", appraisalData.currentUsageStatus === "Đất trống" ? "Có CTXD" : "Đất trống")} >
                                {appraisalData.currentUsageStatus || ""}
                            </div>
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <div className={styles.cellInput} onClick={() => handleComparisonChange(comp._id, "currentUsageStatus", comp.currentUsageStatus === "Đất trống" ? "Có CTXD" : "Đất trống")} >
                                    {comp.currentUsageStatus || ""}
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>12</td>
                        <td>Giá bán (VND)</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <NumberInput className={styles.cellInput} value={comp.price || ""} onChange={value => handleComparisonChange(comp._id, "price", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>13</td>
                        <td>Giá ước tính (VND)</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id} onClick={() => setEditingIndex(comp._id)}>
                                {editingId === comp._id ? (
                                    <PercentInput className={styles.cellInput} value={comp.percent || ""} onChange={v => handleComparisonChange(comp._id, "percent", v)} onBlur={() => setEditingIndex(null)} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { setEditingIndex(null); } }} autoFocus />
                                ) : (
                                    <NumberInput className={styles.cellInput} value={comp.estimatedPrice} roundOnBlur={true} readOnly />
                                )}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td rowSpan={4}>14</td>
                        <td >Diện tích sàn sử dụng (m2)</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {comp.currentUsageStatus === "Có CTXD" && (<NumberInput className={styles.cellInput} value={comp.usableArea || ""} onChange={value => handleComparisonChange(comp._id, "usableArea", value)} />)}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Đơn giá CTXD (VND/m2) căn cứ theo QĐ số 23/2022/QĐ-UBND</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {comp.currentUsageStatus === "Có CTXD" && (<NumberInput className={styles.cellInput} value={comp.constructionUnitPrice || ""} onChange={value => handleComparisonChange(comp._id, "constructionUnitPrice", value)} />)}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>CLCL (%)</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {comp.currentUsageStatus === "Có CTXD" && (<PercentInput className={styles.cellInput} value={comp.qualityRemainingPercent || ""} onChange={value => handleComparisonChange(comp._id, "qualityRemainingPercent", value)} />)}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Giá trị công trình xây dựng (VND)</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {comp.currentUsageStatus === "Có CTXD" ? formatNumber(comp.constructionValue) : ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>15</td>
                        <td style={{ fontWeight: "bold" }}>Đơn giá QSDĐ (VND/m2)</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {formatNumber(comp.landUseRightUnitPrice) || ""}
                            </td>
                        ))}
                    </tr>
                    {allLandTypes.length > 1 && (
                        <>
                            <tr>
                                <td colSpan={comparisonsData.length + 3} style={{ fontWeight: "bold" }}>16. <span style={{ textDecoration: "underline" }}>Thông tin pháp luật</span></td>
                            </tr>
                            <tr>
                                <td colSpan={comparisonsData.length + 3} style={{ fontWeight: "bold" }}>Theo Quyết định số 31/2025/QĐ-UBND ngày 31/03/2025 của UBND {appraisalData.province}</td>
                            </tr>
                            {allLandTypes.map((landType, idx) => (
                                <React.Fragment key={landType}>
                                    <tr>
                                        {idx === 0 && <td rowSpan={2 * allLandTypes.length}>16.1</td>}
                                        <td>Mô tả đoạn đường</td>
                                        <td>
                                            {getLandByType(appraisalData.land, landType) && (<textarea type="text" className={styles.cellInput} value={getLandByType(appraisalData.land, landType).streetDescription || ""} onChange={e => handleAppraisalChange(appraisalData.id, `land.${landType}.streetDescription`, e.target.value)} rows={3} />)}
                                        </td>
                                        {comparisonsData.map((comp) => {
                                            const compLand = getLandByType(comp.land, landType);
                                            return (
                                                <td key={comp._id}>
                                                    {compLand && (<textarea type="text" className={styles.cellInput} value={compLand.streetDescription || ""} onChange={e => handleComparisonChange(comp._id, `land.${landType}.streetDescription`, e.target.value)} rows={3} />)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr>
                                        <td>Đơn giá đất {landType} (VND/m2)</td>
                                        <td>
                                            {getLandByType(appraisalData.land, landType) && (<NumberInput className={styles.cellInput} value={getLandByType(appraisalData.land, landType).ontLandPrice || ""} onChange={value => handleAppraisalChange(appraisalData.id, `land.${landType}.ontLandPrice`, value)} />)}
                                        </td>
                                        {comparisonsData.map((comp) => {
                                            const compLand = getLandByType(comp.land, landType);
                                            return (
                                                <td key={comp._id}>
                                                    {compLand && (
                                                        <NumberInput className={styles.cellInput} value={compLand.ontLandPrice || ""} onChange={value => handleComparisonChange(comp._id, `land.${landType}.ontLandPrice`, value)} />
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            ))}
                            <tr>
                                <td colSpan={comparisonsData.length + 3} style={{ fontWeight: "bold" }}>Theo Quyết định số 19/2023/QĐ-UBND ngày 08/5/2023 của UBND {appraisalData.province}</td>
                            </tr>
                            <tr>
                                <td>16.2</td>
                                <td>Diện tích cho phép chuyển mục đích trong hạn mức</td>
                                <td>
                                    <NumberInput className={styles.cellInput} value={appraisalData.convertibleAreaLimit || ""} onChange={value => handleAppraisalChange(appraisalData.id, "convertibleAreaLimit", value)} />
                                </td>
                                {comparisonsData.map((comp) => (
                                    <td key={comp._id}>
                                        <NumberInput className={styles.cellInput} value={comp.convertibleAreaLimit || ""} onChange={value => handleComparisonChange(comp._id, "convertibleAreaLimit", value)} />
                                    </td>
                                ))}
                            </tr>
                            {landTypesToAdjust && landTypesToAdjust.map((adjustLandType, index) => (
                                <React.Fragment key={`adjust-${adjustLandType}`}>
                                    <tr>
                                        <td colSpan={comparisonsData.length + 3} style={{ fontWeight: "bold" }}>
                                            {17 + index}. <span style={{ textDecoration: "underline" }}>Điều chỉnh đơn giá TSSS là đất {adjustLandType}</span>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td />
                                        <td>Tổng diện tích (m2)</td>
                                        <td />
                                        {comparisonsData.map((comp) => (
                                            <td key={comp._id}>{formatNumber(comp.area)}</td>
                                        ))}
                                    </tr>

                                    <tr>
                                        <td />
                                        <td>Diện tích đất điều chỉnh (m2)</td>
                                        <td />
                                        {comparisonsData.map((comp) => (
                                            <td key={comp._id}>
                                                {getLandByType(comp.land, adjustLandType) && formatNumber(getLandByType(comp.land, adjustLandType).landArea || "")}
                                            </td>
                                        ))}
                                    </tr>

                                    <tr>
                                        <td />
                                        <td>Chênh lệch đơn giá chuyển mục đích từ đất {adjustLandType} sang đất {baseLandType} (VND/m2)</td>
                                        <td />
                                        {comparisonsData.map((comp) => {
                                            return (
                                                <td key={comp._id}>
                                                    {getLandByType(comp.land, adjustLandType) && formatNumber((getLandByType(comp.land, baseLandType)?.ontLandPrice || getLandByType(appraisalData.land, baseLandType)?.ontLandPrice || 0) - (getLandByType(comp.land, adjustLandType)?.ontLandPrice || 0))}
                                                </td>
                                            );
                                        })}
                                    </tr>

                                    <tr>
                                        <td />
                                        <td>Tổng giá trị chênh lệch (VND)</td>
                                        <td />
                                        {comparisonsData.map((comp) => {
                                            const priceDiff = (getLandByType(comp.land, baseLandType)?.ontLandPrice || getLandByType(appraisalData.land, baseLandType)?.ontLandPrice || 0) - (getLandByType(comp.land, adjustLandType)?.ontLandPrice || 0);
                                            return (
                                                <td key={comp._id}>
                                                    {getLandByType(comp.land, adjustLandType) && formatNumber(priceDiff * (getLandByType(comp.land, adjustLandType)?.landArea || 0))}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            ))}
                            <tr>
                                <td />
                                <td style={{ fontWeight: "bold" }}>Đơn giá QSDĐ điều chỉnh (VND/m2)</td>
                                <td />
                                {comparisonsData.map((comp) => (
                                    <td key={comp._id} style={{ fontWeight: "bold" }}>
                                        {formatNumber(comp.adjustedLandUnitPrice)}
                                    </td>
                                ))}
                            </tr>
                        </>
                    )}
                </tbody>
            </table>
        </div>
    )
}

export default BasicSheet;