import styles from "./AppraisalWorksheet.module.css";
import { formatNumber, formatPercent, PercentInput } from "../../hooks/useNumberFormat";

function AdjustmentSheet({ appraisalData, comparisonsData, handleComparisonChange }) {
    return (
        <div className={styles.tableContainer}>
            <table className={styles.comparisonTable}>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Yếu tố so sánh</th>
                        <th>Đơn vị</th>
                        <th>TSTĐ</th>
                        {comparisonsData.map((comp, i) => (
                            <th key={comp._id}>TSSS{i + 1}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>A</td>
                        <td style={{ fontWeight: "bold" }}>Giá thị trường</td>
                        <td />
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {formatNumber(comp.estimatedPrice) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td style={{ fontWeight: "bold" }}>B</td>
                        <td style={{ fontWeight: "bold" }}>Giá quy đổi về đơn vị so sánh chuẩn</td>
                        <td style={{ fontWeight: "bold" }}>VND/m2</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {formatNumber(comp.adjustedLandUnitPrice)}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td style={{ fontWeight: "bold" }}>C</td>
                        <td colSpan={3 + comparisonsData.length} style={{ fontWeight: "bold" }}>Điều chỉnh các yếu tố so sánh</td>
                    </tr>

                    <tr>
                        <td rowSpan={4}>C1</td>
                        <td style={{ fontWeight: "bold" }}>Vị trí</td>
                        <td />
                        <td style={{ fontWeight: "bold" }}>
                            {appraisalData.location?.description || ""}
                        </td>
                        {comparisonsData.map((comp, i) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {comp.location?.description || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Tỷ lệ điều chỉnh</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <PercentInput className={styles.cellInput} value={comp.locationRate || ""} onChange={(value) => handleComparisonChange(comp._id, "locationRate", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Mức điều chỉnh</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * parseFloat(comp.locationRate) / 100) || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Giá sau điều chỉnh:</td>
                        <td style={{ fontWeight: "bold" }}>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * (1 + parseFloat(comp.locationRate) / 100)) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td rowSpan={4}>C2</td>
                        <td style={{ fontWeight: "bold" }}>Kích thước (m)</td>
                        <td style={{ fontWeight: "bold" }}>m</td>
                        <td>
                            <div className={styles.dimensionInput} style={{ fontWeight: "bold" }}>
                                <span>{formatNumber(appraisalData.width || "")}</span>
                                <span>x</span>
                                <span>{appraisalData.length || ""}</span>
                            </div>
                        </td>
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <div className={styles.dimensionInput} style={{ fontWeight: "bold" }}>
                                    <span>{formatNumber(comp.width || "")}</span>
                                    <span>x</span>
                                    <span>{formatNumber(comp.length) || ""}</span>
                                </div>
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Tỷ lệ điều chỉnh</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <PercentInput className={styles.cellInput} value={comp.sizeRate || ""} onChange={(value) => handleComparisonChange(comp._id, "sizeRate", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Mức điều chỉnh</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * (parseFloat(comp.sizeRate) / 100)) || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Giá sau điều chỉnh:</td>
                        <td style={{ fontWeight: "bold" }}>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * (1 + (parseFloat(comp.sizeRate) + parseFloat(comp.locationRate)) / 100)) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td rowSpan={4}>C3</td>
                        <td style={{ fontWeight: "bold" }}>Quy mô diện tích</td>
                        <td style={{ fontWeight: "bold" }}>m2</td>
                        <td style={{ fontWeight: "bold" }}>
                            {appraisalData.area || ""}
                        </td>
                        {comparisonsData.map((comp, i) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {comp.area || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Tỷ lệ điều chỉnh</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <PercentInput className={styles.cellInput} value={comp.areaRate || ""} onChange={(value) => handleComparisonChange(comp._id, "areaRate", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Mức điều chỉnh</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * parseFloat(comp.areaRate) / 100) || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Giá sau điều chỉnh:</td>
                        <td style={{ fontWeight: "bold" }}>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * (1 + (parseFloat(comp.areaRate) + parseFloat(comp.sizeRate) + parseFloat(comp.locationRate)) / 100)) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td rowSpan={4}>C4</td>
                        <td style={{ fontWeight: "bold" }}>Hình dáng</td>
                        <td />
                        <td style={{ fontWeight: "bold" }}>
                            {appraisalData.shape || ""}
                        </td>
                        {comparisonsData.map((comp, i) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {comp.shape || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Tỷ lệ điều chỉnh</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <PercentInput className={styles.cellInput} value={comp.shapeRate || ""} onChange={(value) => handleComparisonChange(comp._id, "shapeRate", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Mức điều chỉnh</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * parseFloat(comp.shapeRate) / 100) || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Giá sau điều chỉnh:</td>
                        <td style={{ fontWeight: "bold" }}>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * (1 + (parseFloat(comp.shapeRate) + parseFloat(comp.areaRate) + parseFloat(comp.sizeRate) + parseFloat(comp.locationRate)) / 100)) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td rowSpan={4}>C5</td>
                        <td style={{ fontWeight: "bold" }}>Lợi thế kinh doanh</td>
                        <td />
                        <td style={{ fontWeight: "bold" }}>
                            {appraisalData.businessAdvantage || ""}
                        </td>
                        {comparisonsData.map((comp, i) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {comp.businessAdvantage || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Tỷ lệ điều chỉnh</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <PercentInput className={styles.cellInput} value={comp.businessRate || ""} onChange={(value) => handleComparisonChange(comp._id, "businessRate", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Mức điều chỉnh</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * parseFloat(comp.businessRate) / 100) || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Giá sau điều chỉnh:</td>
                        <td style={{ fontWeight: "bold" }}>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * (1 + (parseFloat(comp.businessRate) + parseFloat(comp.shapeRate) + parseFloat(comp.areaRate) + parseFloat(comp.sizeRate) + parseFloat(comp.locationRate)) / 100)) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td rowSpan={4}>C6</td>
                        <td style={{ fontWeight: "bold" }}>Môi trường sống</td>
                        <td />
                        <td style={{ fontWeight: "bold" }}>
                            {appraisalData.livingEnvironment || ""}
                        </td>
                        {comparisonsData.map((comp, i) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {comp.livingEnvironment || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Tỷ lệ điều chỉnh</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                <PercentInput className={styles.cellInput} value={comp.environmentRate || ""} onChange={(value) => handleComparisonChange(comp._id, "environmentRate", value)} />
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>Mức điều chỉnh</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * parseFloat(comp.environmentRate) / 100) || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td style={{ fontWeight: "bold" }}>Giá sau điều chỉnh:</td>
                        <td style={{ fontWeight: "bold" }}>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.adjustedLandUnitPrice * (1 + (parseFloat(comp.environmentRate) + parseFloat(comp.businessRate) + parseFloat(comp.shapeRate) + parseFloat(comp.areaRate) + parseFloat(comp.sizeRate) + parseFloat(comp.locationRate)) / 100)) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td style={{ fontWeight: "bold" }}>D</td>
                        <td style={{ fontWeight: "bold" }}>Mức giá chỉ dẫn</td>
                        <td style={{ fontWeight: "bold" }}>VND/m2</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id} style={{ fontWeight: "bold" }}>
                                {formatNumber(comp.guidedPrice) || ""}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td>D1</td>
                        <td>Giá trị trung bình của mức giá chỉ dẫn</td>
                        <td>Đồng</td>
                        <td />
                        <td colSpan={comparisonsData.length}>
                            {formatNumber(appraisalData.guidedPriceAverage)}
                        </td>
                    </tr>
                    <tr>
                        <td>D2</td>
                        <td>Mức độ chênh lệch với giá trị trung bình</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatPercent((comp.guidedPrice - appraisalData.guidedPriceAverage) * 100 / appraisalData.guidedPriceAverage) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td style={{ fontWeight: "bold" }}>E</td>
                        <td style={{ fontWeight: "bold" }} colSpan={3 + comparisonsData.length}>Tổng hợp các số liệu điều chỉnh tại mục C</td>
                    </tr>

                    <tr>
                        <td>E1</td>
                        <td>Tổng giá trị điều chỉnh gộp</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => {
                            const rates = [comp.areaRate, comp.sizeRate, comp.shapeRate, comp.businessRate, comp.locationRate, comp.environmentRate].map(r => parseFloat(r) || 0);
                            const totalAdjustment = rates.reduce((sum, rate) => sum + Math.abs(comp.adjustedLandUnitPrice * rate / 100), 0);
                            return <td key={comp._id}>{formatNumber(totalAdjustment)}</td>;
                        })}
                    </tr>

                    <tr>
                        <td>E2</td>
                        <td>Tổng số lần điều chỉnh</td>
                        <td>Lần</td>
                        <td />
                        {comparisonsData.map((comp) => {
                            const rates = [comp.areaRate, comp.sizeRate, comp.shapeRate, comp.businessRate, comp.locationRate, comp.environmentRate];
                            return <td key={comp._id}>{rates.filter(rate => rate && parseFloat(rate) !== 0).length}</td>;
                        })}
                    </tr>

                    <tr>
                        <td>E3</td>
                        <td>Biên độ điều chỉnh</td>
                        <td>%</td>
                        <td />
                        {comparisonsData.map((comp) => {
                            const rates = [comp.areaRate, comp.sizeRate, comp.shapeRate, comp.businessRate, comp.locationRate, comp.environmentRate].map(r => parseFloat(r) || 0);
                            const min = Math.min(...rates);
                            const max = Math.max(...rates);
                            return <td key={comp._id}>{Math.round(min)}-{Math.round(max)}%</td>;
                        })}
                    </tr>

                    <tr>
                        <td>E4</td>
                        <td>Tổng giá trị điều chỉnh thuần</td>
                        <td>Đồng</td>
                        <td />
                        {comparisonsData.map((comp) => (
                            <td key={comp._id}>
                                {formatNumber(comp.guidedPrice - comp.adjustedLandUnitPrice) || ""}
                            </td>
                        ))}
                    </tr>

                    <tr>
                        <td style={{ fontWeight: "bold" }}>F</td>
                        <td colSpan={2 + comparisonsData.length} style={{ fontWeight: "bold" }}>Xác định mức giá cho tài sản thẩm định giá</td>
                        <td style={{ fontWeight: "bold" }}>
                            {formatNumber(appraisalData.guidedPriceAverage, 3)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default AdjustmentSheet;