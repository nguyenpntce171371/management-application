import ExcelJS from "exceljs";

export const exportPropertyComparisonToExcel = async (appraisalProperties, comparisonsData, constructionWorks, getLandByType) => {
    const workbook = new ExcelJS.Workbook();
    const appraisalLandRowMaps = {};
    appraisalProperties.forEach(appraisal => {
        const selectedComparisons = comparisonsData.filter(comp => appraisal.selectedComparisons?.includes(comp.id || comp._id));
        const { estimatedPriceRow, lastRow, rowReferences, landRowMap } = createBasicSheet(workbook, appraisal, selectedComparisons, getLandByType);
        appraisalLandRowMaps[appraisal.id] = landRowMap;
        createAdjustmentSheet(workbook, appraisal, selectedComparisons, estimatedPriceRow, lastRow, rowReferences);
    });

    createTotalSheet(workbook, appraisalProperties, constructionWorks, appraisalLandRowMaps);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Tham_dinh_gia_${new Date().getTime()}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
};

const createBasicSheet = (workbook, appraisal, comparisons, getLandByType) => {
    const sheet = workbook.addWorksheet(`${appraisal.name}`);

    sheet.getColumn(1).width = 6.34;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 33;
    comparisons.forEach((_, i) => {
        sheet.getColumn(4 + i).width = 33;
    });

    const headerRow = sheet.addRow(["STT", "Yếu tố so sánh", "TSTĐ", ...comparisons.map((_, i) => `TSSS${i + 1}`)]);

    headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD9D9D9" }
        };
        cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
        };
    });
    headerRow.height = 30;

    const addRow = (stt, label, appraisalValue, comparisonValues, options = {}) => {
        const row = sheet.addRow([
            stt,
            label,
            appraisalValue ?? "",
            ...comparisonValues
        ]);

        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };

            cell.alignment = {
                vertical: "middle",
                horizontal: colNumber === 2 ? "left" : "center",
                wrapText: true
            };


            if (options.bold) cell.font = { ...cell.font, bold: true };
            if (options.italic) cell.font = { ...cell.font, italic: true };
            if (options.underline) cell.font = { ...cell.font, underline: true };
            if (options.color) cell.font = { ...cell.font, color: { argb: options.color } };
            if (options.decimal2) { cell.numFmt = "#,##0.00"; }
            if (options.number) { cell.numFmt = "#,##0"; }

            if (options.cellStyles && options.cellStyles[colNumber]) {
                const custom = options.cellStyles[colNumber];
                if (custom.bold) cell.font = { ...cell.font, bold: true };
                if (custom.italic) cell.font = { ...cell.font, italic: true };
                if (custom.underline) cell.font = { ...cell.font, underline: true };
                if (custom.color) cell.font = { ...cell.font, color: { argb: custom.color } };
                if (custom.decimal2) { cell.numFmt = "#,##0.00"; }
                if (custom.number) { cell.numFmt = "#,##0"; }

            }
        });

        if (options.height) row.height = options.height;

        return row;
    };

    const rowReferences = {};
    addRow("1", "Thời điểm/Tình trạng giao dịch", "", comparisons.map(c => c.transactionTime || ""));
    addRow("1.1", "Nguồn", "", comparisons.map(c => c.source || ""), { cellStyles: { 1: { italic: true } } });
    addRow("1.2", "Thông tin liên lạc", "", comparisons.map(c => c.contactInfo || ""), {
        cellStyles: {
            1: { italic: true },
            2: {},
            3: {},
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { color: "FFFF0000" }
                ])
            )
        }
    });
    addRow("2", "Tình trạng pháp lý", appraisal.legalStatus || "", comparisons.map(c => c.legalStatus || ""));
    addRow("3", "Mục đích sử dụng đất", appraisal.land?.map(l => l.landType).join(" + ") || "", comparisons.map(c => c.land?.map(l => l.landType).join(" + ") || ""));
    const locationRow1 = addRow("4", "Vị trí", appraisal.location?.landParcel || "", comparisons.map(c => c.location?.landParcel || ""), { height: 100 });
    const locationRow2 = addRow("", "", appraisal.location?.description || "", comparisons.map(c => c.location?.description || ""), { height: 80 });
    sheet.mergeCells(locationRow1.number, 1, locationRow2.number, 1);
    sheet.mergeCells(locationRow1.number, 2, locationRow2.number, 2);
    rowReferences.location = locationRow2.number;
    const sizeRow = addRow("5", "Kích thước (m)", appraisal.width && appraisal.length ? `${appraisal.width} x ${appraisal.length}` : "", comparisons.map(c => c.width && c.length ? `${c.width} x ${c.length}` : ""));
    rowReferences.size = sizeRow.number;
    const businessRow = addRow("6", "Lợi thế kinh doanh", appraisal.businessAdvantage || "", comparisons.map(c => c.businessAdvantage || ""));
    rowReferences.business = businessRow.number;
    const environmentRow = addRow("7", "Môi trường sống", appraisal.livingEnvironment || "", comparisons.map(c => c.livingEnvironment || ""));
    rowReferences.environment = environmentRow.number;
    const totalAreaRow = addRow("8", "Quy mô diện tích (m2)", Number(appraisal.area) || 0, comparisons.map(c => Number(c.area) || 0), {
        bold: true, cellStyles: {
            3: { decimal2: true },
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { decimal2: true }
                ])
            )
        }
    });
    rowReferences.area = totalAreaRow.number;
    const allLandTypes = Array.from(new Set([...(appraisal.land?.map(l => l.landType) || []), ...comparisons.flatMap(c => c.land?.map(l => l.landType) || [])]));
    const landRowMap = {};
    allLandTypes.forEach((landType, idx) => {
        const appraisalLand = getLandByType(appraisal.land, landType);
        const areaRow = addRow(`8.${idx + 1}`, `Đất ${landType} (m2)`, Number(appraisalLand?.landArea) || 0, comparisons.map(c => (Number(getLandByType(c.land, landType)?.landArea) || 0)), {
            italic: true, cellStyles: {
                3: { decimal2: true },
                ...Object.fromEntries(
                    Array.from({ length: comparisons.length }, (_, i) => [
                        4 + i,
                        { decimal2: true }
                    ])
                )
            }
        });
        landRowMap[landType] = { areaRow: areaRow.number };
    });
    addRow("9", "Cơ sở hạ tầng", appraisal.infrastructure || "", comparisons.map(c => c.infrastructure || ""));
    const shapeRow = addRow("10", "Hình dáng", appraisal.shape || "", comparisons.map(c => c.shape || ""));
    rowReferences.shape = shapeRow.number;
    const currentUsageStatusRow = addRow("11", "Hiện trạng sử dụng", appraisal.currentUsageStatus || "", comparisons.map(c => c.currentUsageStatus || ""));
    addRow("12", "Giá bán (VND)", "", comparisons.map(c => Number(c.price)), {
        cellStyles: {
            3: { number: true },
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { number: true }
                ])
            )
        }
    });
    const estimatedPriceRow = addRow("13", "Giá ước tính (VND)", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(4 + i).letter;
        const rowAbove = sheet.lastRow.number;
        const formula = `${col}${rowAbove}*${parseFloat(c.percent) / 100}`;
        const result = Number(c.estimatedPrice);
        return { formula, result };
    }), {
        cellStyles: {
            3: { number: true },
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { number: true }
                ])
            )
        }
    });
    const ctxdStartRow = sheet.lastRow.number + 1;
    const usableAreaRow = addRow("14", "Diện tích sàn sử dụng (m2)", "", comparisons.map(c => c.currentUsageStatus === "Có CTXD" ? Number(c.usableArea) || "" : ""), {
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { decimal2: true }
                ])
            )
        }
    });
    addRow("", "Đơn giá CTXD (VND/m2) căn cứ theo QĐ số 23/2022/QĐ-UBND", "", comparisons.map(c => c.currentUsageStatus === "Có CTXD" ? Number(c.constructionUnitPrice) || "" : ""), {
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { number: true }
                ])
            )
        }
    });
    addRow("", "CLCL (%)", "", comparisons.map(c => c.currentUsageStatus === "Có CTXD" ? c.qualityRemainingPercent || "" : ""));
    const constructionValueRow = addRow("", "Giá trị công trình xây dựng (VND)", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(4 + i).letter;
        const formula = `IF(${col}${currentUsageStatusRow.number}="Có CTXD",${col}${usableAreaRow.number}*${col}${sheet.lastRow.number - 1}*${col}${sheet.lastRow.number},"")`;
        if (c.currentUsageStatus != "Có CTXD") return { formula };
        const result = Number(c.constructionValue);
        return { formula, result };
    }), {
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { number: true }
                ])
            )
        }
    });
    sheet.mergeCells(ctxdStartRow, 1, ctxdStartRow + 3, 1);
    let lastRow = addRow("15", "Đơn giá QSDĐ (VND/m2)", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(4 + i).letter;
        const formula = `(${col}${estimatedPriceRow.number}-N(${col}${constructionValueRow.number}))/${col}${totalAreaRow.number}`;
        const result = Number(c.landUseRightUnitPrice);
        return { formula, result };
    }), {
        bold: true,
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    4 + i,
                    { number: true }
                ])
            )
        }
    });
    if (allLandTypes.length > 1) {
        const infoRow = addRow("16. Thông tin pháp luật", "", "", comparisons.map(() => ""), { bold: true, underline: true });
        sheet.mergeCells(infoRow.number, 1, infoRow.number, 3 + comparisons.length);
        const qd31Row = addRow(`Theo Quyết định số 31/2025/QĐ-UBND ngày 31/03/2025 của UBND ${appraisal.province}`, "", "", comparisons.map(() => ""), { bold: true });
        sheet.mergeCells(qd31Row.number, 1, qd31Row.number, 3 + comparisons.length);
        let descRow = 0;
        allLandTypes.forEach((landType, idx) => {
            const appraisalLand = getLandByType(appraisal.land, landType);
            const firstRow = addRow(idx === 0 ? "16.1" : "", "Mô tả đoạn đường", appraisalLand?.streetDescription || "", comparisons.map(c => (getLandByType(c.land, landType)?.streetDescription || "")), { height: 40 });
            const priceRow = addRow("", `Đơn giá đất ${landType} (VND/m2)`, appraisalLand?.ontLandPrice || "", comparisons.map(c => (getLandByType(c.land, landType)?.ontLandPrice || "")));
            landRowMap[landType].unitPriceRow = priceRow.number;
            descRow = idx === 0 ? firstRow : descRow;
        });
        sheet.mergeCells(descRow.number, 1, descRow.number + (allLandTypes.length * 2) - 1, 1);
        const qd19Row = addRow(`Theo Quyết định số 19/2023/QĐ-UBND ngày 08/5/2023 của UBND ${appraisal.province}`, "", "", comparisons.map(() => ""), { bold: true });
        sheet.mergeCells(qd19Row.number, 1, qd19Row.number, 3 + comparisons.length);
        addRow("16.2", "Diện tích cho phép chuyển mục đích trong hạn mức", Number(appraisal.convertibleAreaLimit) || "", comparisons.map(c => Number(c.convertibleAreaLimit) || ""), { number: true });
        const baseLandType = appraisal.land?.[0]?.landType;
        const allComparisonLandTypes = Array.from(new Set(comparisons.flatMap(c => c.land?.map(l => l.landType) || [])));
        const landTypesToAdjust = allComparisonLandTypes.filter(lt => lt !== baseLandType);
        const adjustDiffRows = [];
        landTypesToAdjust.forEach((adjustLandType, i) => {
            const adjustHeaderRow = addRow(`${17 + i}. Điều chỉnh đơn giá TSSS là đất ${adjustLandType}`, "", "", comparisons.map(() => ""), { bold: true, underline: true });
            sheet.mergeCells(adjustHeaderRow.number, 1, adjustHeaderRow.number, 3 + comparisons.length);
            const adjustAreaRow = landRowMap[adjustLandType].areaRow;
            const adjustUnitPriceRow = landRowMap[adjustLandType].unitPriceRow;
            const baseUnitPriceRow = landRowMap[baseLandType].unitPriceRow;
            const startRow = addRow("", "Tổng diện tích (m2)", "", comparisons.map((c, i) => {
                const col = sheet.getColumn(4 + i).letter;
                const formula = `${col}${totalAreaRow.number}`;
                const result = Number(c.area);
                return { formula, result };
            }), {
                bold: true,
                cellStyles: {
                    ...Object.fromEntries(
                        Array.from({ length: comparisons.length }, (_, i) => [
                            4 + i,
                            { number: true }
                        ])
                    )
                }
            });
            addRow("", "Diện tích đất điều chỉnh (m2)", "", comparisons.map((c, i) => {
                if (!getLandByType(c.land, adjustLandType)) return "";
                const col = sheet.getColumn(4 + i).letter;
                const formula = `${col}${adjustAreaRow}`;
                const result = Number(getLandByType(c.land, adjustLandType)?.landArea);
                return { formula, result };
            }), {
                cellStyles: {
                    ...Object.fromEntries(
                        Array.from({ length: comparisons.length }, (_, i) => [
                            4 + i,
                            { number: true }
                        ])
                    )
                }
            });
            addRow("", `Chênh lệch đơn giá chuyển mục đích từ đất ${adjustLandType} sang đất ${baseLandType} (VND/m2)`, "", comparisons.map((c, i) => {
                if (!getLandByType(c.land, adjustLandType)) return "";
                const col = sheet.getColumn(4 + i).letter;
                const formula = `${sheet.getColumn(3).letter}${baseUnitPriceRow}-${col}${adjustUnitPriceRow}`;
                const result = Number(getLandByType(appraisal.land, baseLandType)?.ontLandPrice - getLandByType(c.land, adjustLandType)?.ontLandPrice);
                return { formula, result };
            }), {
                cellStyles: {
                    ...Object.fromEntries(
                        Array.from({ length: comparisons.length }, (_, i) => [
                            4 + i,
                            { number: true }
                        ])
                    )
                }
            });
            const diffValueRow = addRow("", "Tổng giá trị chênh lệch (VND)", "", comparisons.map((c, i) => {
                if (!getLandByType(c.land, adjustLandType)) return "";
                const col = sheet.getColumn(4 + i).letter;
                const formula = `${col}${sheet.lastRow.number}*${col}${sheet.lastRow.number - 1}`;
                const result = Number((getLandByType(appraisal.land, baseLandType)?.ontLandPrice - getLandByType(c.land, adjustLandType)?.ontLandPrice) * getLandByType(c.land, adjustLandType)?.landArea);
                return { formula, result };
            }), {
                cellStyles: {
                    ...Object.fromEntries(
                        Array.from({ length: comparisons.length }, (_, i) => [
                            4 + i,
                            { number: true }
                        ])
                    )
                }
            });
            sheet.mergeCells(startRow.number, 1, diffValueRow.number, 1);
            adjustDiffRows.push(diffValueRow.number);
        });
        lastRow = addRow("Đơn giá QSDĐ điều chỉnh (VND/m2)", "", "", comparisons.map((c, i) => {
            const col = sheet.getColumn(4 + i).letter;
            const diffSum = adjustDiffRows.map(r => `N(${col}${r})`).join("+") || "";
            const formula = `(${col}${estimatedPriceRow.number}+${diffSum}-N(${col}${constructionValueRow.number}))/${col}${totalAreaRow.number}`;
            const result = Number(c.adjustedLandUnitPrice);
            return { formula, result };
        }), {
            bold: true,
            cellStyles: {
                ...Object.fromEntries(
                    Array.from({ length: comparisons.length }, (_, i) => [
                        4 + i,
                        { number: true }
                    ])
                )
            }
        });
        sheet.mergeCells(lastRow.number, 1, lastRow.number, 3);
    }

    sheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                wrapText: true
            };
            cell.font = { ...cell.font, name: "Times New Roman", size: 12 };
        });
    });

    return { estimatedPriceRow: estimatedPriceRow.number, lastRow: lastRow.number, rowReferences, landRowMap };
};

const createAdjustmentSheet = (workbook, appraisal, comparisons, estimatedPriceRow, lastRow, rowReferences) => {
    const sheet = workbook.addWorksheet(`Điều chỉnh(${appraisal.name})`);
    sheet.getColumn(1).width = 6.34;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 33;
    comparisons.forEach((_, i) => {
        sheet.getColumn(5 + i).width = 33;
    });

    const headerRow = sheet.addRow(["STT", "Yếu tố so sánh", "Đơn vị tính", "TSTĐ", ...comparisons.map((_, i) => `TSSS${i + 1}`)]);

    headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD9D9D9" }
        };
        cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
        };
    });
    headerRow.height = 30;

    const addRow = (stt, label, unit, appraisalValue, comparisonValues, options = {}) => {
        const row = sheet.addRow([
            stt,
            label,
            unit,
            appraisalValue || "",
            ...comparisonValues
        ]);

        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };

            cell.alignment = {
                vertical: "middle",
                horizontal: colNumber === 2 ? "left" : "center",
                wrapText: true
            };


            if (options.bold) cell.font = { ...cell.font, bold: true };
            if (options.italic) cell.font = { ...cell.font, italic: true };
            if (options.underline) cell.font = { ...cell.font, underline: true };
            if (options.color) cell.font = { ...cell.font, color: { argb: options.color } };
            if (options.decimal2) { cell.numFmt = "#,##0.00"; }
            if (options.number) { cell.numFmt = "#,##0"; }
            if (options.percent) { cell.numFmt = '0.00%'; }

            if (options.cellStyles && options.cellStyles[colNumber]) {
                const custom = options.cellStyles[colNumber];
                if (custom.bold) cell.font = { ...cell.font, bold: true };
                if (custom.italic) cell.font = { ...cell.font, italic: true };
                if (custom.underline) cell.font = { ...cell.font, underline: true };
                if (custom.color) cell.font = { ...cell.font, color: { argb: custom.color } };
                if (custom.decimal2) { cell.numFmt = "#,##0.00"; }
                if (custom.number) { cell.numFmt = "#,##0"; }
                if (custom.percent) { cell.numFmt = '0.00%'; }
            }
        });

        if (options.height) row.height = options.height;

        return row;
    };

    addRow("A", "Giá thị trường", "", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(4 + i).letter;
        const formula = `'${appraisal.name}'!${col}${estimatedPriceRow}`;
        const result = Number(c.estimatedPrice);
        return { formula, result };
    }), {
        bold: true,
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    5 + i,
                    { number: true }
                ])
            )
        }
    });
    const priceRow = addRow("B", "Giá quy đổi về đơn vị so sánh chuẩn", "VND/m2", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(4 + i).letter;
        const formula = `'${appraisal.name}'!${col}${lastRow}`;
        const result = Number(c.adjustedLandUnitPrice);
        return { formula, result };
    }), {
        bold: true,
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    5 + i,
                    { number: true }
                ])
            )
        }
    });
    const cHeaderRow = addRow("C", "Điều chỉnh các yếu tố so sánh", "", "", comparisons.map(() => ""), { bold: true });
    sheet.mergeCells(cHeaderRow.number, 2, cHeaderRow.number, 4 + comparisons.length);
    const adjustmentValueRows = {};
    const adjustmentRateRows = {};
    const addAdjustmentGroup = (code, title, rowRef, getRateProp) => {
        const startRow = sheet.lastRow.number + 1;
        const rowOptions = { bold: true };
        if (getRateProp === "locationRate") {
            rowOptions.height = 80;
        }
        if (getRateProp === "areaRate") {
            rowOptions.cellStyles = {
                4: { decimal2: true },
                ...Object.fromEntries(
                    Array.from({ length: comparisons.length }, (_, i) => [
                        5 + i,
                        { decimal2: true }
                    ])
                )
            };
        }
        const appraisalValue = (() => {
            const formula = `'${appraisal.name}'!C${rowRef}`;
            let result = "";
            switch (getRateProp) {
                case "locationRate":
                    result = appraisal.location?.description || "";
                    break;
                case "sizeRate":
                    result = appraisal.width && appraisal.length ? `${appraisal.width} x ${appraisal.length}` : "";
                    break;
                case "areaRate":
                    result = appraisal.area || "";
                    break;
                case "shapeRate":
                    result = appraisal.shape || "";
                    break;
                case "businessRate":
                    result = appraisal.businessAdvantage || "";
                    break;
                case "environmentRate":
                    result = appraisal.livingEnvironment || "";
                    break;
            }
            return { formula, result };
        })();

        const comparisonValues = comparisons.map((c, i) => {
            const col = sheet.getColumn(4 + i).letter;
            const formula = `'${appraisal.name}'!${col}${rowRef}`;
            let result = "";
            switch (getRateProp) {
                case "locationRate":
                    result = c.location?.description || "";
                    break;
                case "sizeRate":
                    result = c.width && c.length ? `${c.width} x ${c.length}` : "";
                    break;
                case "areaRate":
                    result = c.area || "";
                    break;
                case "shapeRate":
                    result = c.shape || "";
                    break;
                case "businessRate":
                    result = c.businessAdvantage || "";
                    break;
                case "environmentRate":
                    result = c.livingEnvironment || "";
                    break;
            }
            return { formula, result };
        });
        addRow(code, title, "", appraisalValue, comparisonValues, rowOptions);
        addRow("", "Tỷ lệ điều chỉnh", "%", "", comparisons.map(c => c[getRateProp]));
        adjustmentRateRows[getRateProp] = sheet.lastRow.number;
        addRow("", "Mức điều chỉnh", "Đồng", "", comparisons.map((c, i) => {
            const col = sheet.getColumn(5 + i).letter;
            const formula = `${col}${sheet.lastRow.number}*${col}${priceRow.number}`;
            const result = parseFloat(c[getRateProp]) * c.adjustedLandUnitPrice / 100;
            return { formula, result };
        }), {
            cellStyles: {
                ...Object.fromEntries(
                    Array.from({ length: comparisons.length }, (_, i) => [
                        5 + i,
                        { number: true }
                    ])
                )
            }
        });
        adjustmentValueRows[getRateProp] = sheet.lastRow.number;
        const prevRates = ["locationRate", "sizeRate", "areaRate", "shapeRate", "businessRate", "environmentRate"];
        const currentIndex = prevRates.indexOf(getRateProp);
        addRow("", "Giá sau điều chỉnh:", "Đồng", "", comparisons.map((c, i) => {
            const col = sheet.getColumn(5 + i).letter;
            const formulaSum = Array.from({ length: currentIndex + 1 }, (_, k) => {
                const rowNum = sheet.lastRow.number - 1 - (k * 4);
                return `${col}${rowNum}`;
            }).join("+");
            const formula = `${col}${priceRow.number}*(1+${formulaSum})`;
            const totalRate = prevRates.slice(0, currentIndex + 1).reduce((sum, key) => sum + parseFloat(c[key] || 0), 0);
            const result = c.adjustedLandUnitPrice * (1 + totalRate / 100);
            return { formula, result };
        }), {
            bold: true,
            cellStyles: {
                ...Object.fromEntries(
                    Array.from({ length: comparisons.length }, (_, i) => [
                        5 + i,
                        { number: true }
                    ])
                )
            }
        });
        sheet.mergeCells(startRow, 1, startRow + 3, 1);
    };
    addAdjustmentGroup("C1", "Vị trí", rowReferences.location, "locationRate");
    addAdjustmentGroup("C2", "Kích thước (m)", rowReferences.size, "sizeRate");
    addAdjustmentGroup("C3", "Quy mô diện tích", rowReferences.area, "areaRate");
    addAdjustmentGroup("C4", "Hình dáng", rowReferences.shape, "shapeRate");
    addAdjustmentGroup("C5", "Lợi thế kinh doanh", rowReferences.business, "businessRate");
    addAdjustmentGroup("C6", "Môi trường sống", rowReferences.environment, "environmentRate");
    const dRow = addRow("D", "Mức giá chỉ dẫn", "VND/m2", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(5 + i).letter;
        const formula = `${col}${sheet.lastRow.number}`;
        const result = Number(c.guidedPrice);
        return { formula, result };
    }), {
        bold: true,
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    5 + i,
                    { number: true }
                ])
            )
        }
    });
    const d1Row = addRow("D1", "Giá trị trung bình của mức giá chỉ dẫn", "Đồng", "", comparisons.map((c, i) => {
        if (i === 0) {
            const cols = comparisons.map((_, idx) => `${sheet.getColumn(5 + idx).letter}${sheet.lastRow.number}`).join("+");
            const formula = `(${cols})/${comparisons.length}`;
            const result = Number(appraisal.guidedPriceAverage);
            return { formula, result };
        }
        return "";
    }), {
        cellStyles: {
            5: { number: true }
        }
    });
    if (comparisons.length > 0) {
        sheet.mergeCells(sheet.lastRow.number, 5, sheet.lastRow.number, 4 + comparisons.length);
    }
    addRow("D2", "Mức độ chênh lệch với giá trị trung bình", "%", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(5 + i).letter;
        const formula = `(${col}${dRow.number}-E${sheet.lastRow.number})/E${sheet.lastRow.number}`;
        const result = (c.guidedPrice - appraisal.guidedPriceAverage) / appraisal.guidedPriceAverage;
        return { formula, result };
    }), {
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    5 + i,
                    { percent: true }
                ])
            )
        }
    });
    const eHeaderRow = addRow("E", "Tổng hợp các số liệu điều chỉnh tại mục C", "", "", comparisons.map(() => ""), { bold: true });
    sheet.mergeCells(eHeaderRow.number, 2, eHeaderRow.number, 4 + comparisons.length);
    addRow("E1", "Tổng giá trị điều chỉnh gộp", "Đồng", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(5 + i).letter;
        const adjustmentRows = Object.values(adjustmentValueRows);
        const absSum = adjustmentRows.map(row => `ABS(${col}${row})`).join("+");
        const formula = `${absSum}`;
        const rates = ["areaRate", "sizeRate", "shapeRate", "businessRate", "locationRate", "environmentRate"].map(r => parseFloat(c[r]) || 0);
        const result = rates.reduce((sum, rate) => sum + Math.abs(c.adjustedLandUnitPrice * rate / 100), 0);
        return { formula, result };
    }), {
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    5 + i,
                    { number: true }
                ])
            )
        }
    });
    addRow("E2", "Tổng số lần điều chỉnh", "Lần", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(5 + i).letter;
        const rateRows = Object.values(adjustmentRateRows);
        const formula = `${rateRows.map(row => `IF(${col}${row}<>0,1,0)`).join("+")}`;
        const rates = ["areaRate", "sizeRate", "shapeRate", "businessRate", "locationRate", "environmentRate"];
        const result = rates.filter(r => c[r] && parseFloat(c[r]) !== 0).length;
        return { formula, result };
    }));
    addRow("E3", "Biên độ điều chỉnh", "%", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(5 + i).letter;
        const rateRows = Object.values(adjustmentRateRows);
        const minFormula = `MIN(${rateRows.map(row => `${col}${row}`).join(",")})`;
        const maxFormula = `MAX(${rateRows.map(row => `${col}${row}`).join(",")})`;
        const formula = `${minFormula}&"-"&${maxFormula}&"%"`;
        const rates = ["areaRate", "sizeRate", "shapeRate", "businessRate", "locationRate", "environmentRate"].map(r => parseFloat(c[r]) || 0);
        const result = `${Math.min(...rates)}-${Math.max(...rates)}%`;
        return { formula, result };
    }));
    addRow("E4", "Tổng giá trị điều chỉnh thuần", "Đồng", "", comparisons.map((c, i) => {
        const col = sheet.getColumn(5 + i).letter;
        const formula = `${col}${dRow.number}-${col}${priceRow.number}`;
        const result = (c.guidedPrice || 0) - (c.adjustedLandUnitPrice || 0);
        return { formula, result };
    }), {
        cellStyles: {
            ...Object.fromEntries(
                Array.from({ length: comparisons.length }, (_, i) => [
                    5 + i,
                    { number: true }
                ])
            )
        }
    });
    addRow("F", "Xác định mức giá cho tài sản thẩm định giá", "", "", comparisons.map((c, i) => {
        if (i === comparisons.length - 1) {
            const formula = `ROUND(E${d1Row.number},-3)`;
            const result = Math.round(appraisal.guidedPriceAverage / 1000) * 1000;
            return { formula, result };
        }
        return "";
    }), {
        bold: true,
        cellStyles: {
            [4 + comparisons.length]: { number: true }
        }
    });
    sheet.mergeCells(sheet.lastRow.number, 2, sheet.lastRow.number, 3 + comparisons.length);

    sheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                wrapText: true
            };
            cell.font = { ...cell.font, name: "Times New Roman", size: 12 };
        });
    });
};

const createTotalSheet = (workbook, appraisalProperties, constructionWorks, appraisalLandRowMaps) => {
    const sheet = workbook.addWorksheet("Tổng cộng");
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 15;
    sheet.getColumn(5).width = 20;
    sheet.getColumn(6).width = 25;
    const titleRow = sheet.addRow(["KẾT QUẢ THẨM ĐỊNH GIÁ", "", "", "", "", ""]);
    sheet.mergeCells(titleRow.number, 1, titleRow.number, 6);
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    titleRow.height = 35;
    const headerRow = sheet.addRow(["STT", "Tên tài sản", "Loại đất/CLCL (%)", "Diện tích (m2)", "Đơn giá (VND/m2)", "Thành tiền (VND)"]);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD9D9D9" }
        };
        cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
        };
    });
    headerRow.height = 30;
    const addRow = (col1, col2, col3, col4, col5, col6, options = {}) => {
        const row = sheet.addRow([col1, col2, col3, col4, col5, col6]);

        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };

            cell.alignment = {
                vertical: "middle",
                horizontal: colNumber === 2 ? "left" : "center",
                wrapText: true
            };


            if (options.bold) cell.font = { ...cell.font, bold: true };
            if (options.italic) cell.font = { ...cell.font, italic: true };
            if (options.underline) cell.font = { ...cell.font, underline: true };
            if (options.color) cell.font = { ...cell.font, color: { argb: options.color } };
            if (options.decimal2) { cell.numFmt = "#,##0.00"; }
            if (options.number) { cell.numFmt = "#,##0"; }
            if (options.percent) { cell.numFmt = '0.00%'; }

            if (options.cellStyles && options.cellStyles[colNumber]) {
                const custom = options.cellStyles[colNumber];
                if (custom.bold) cell.font = { ...cell.font, bold: true };
                if (custom.italic) cell.font = { ...cell.font, italic: true };
                if (custom.underline) cell.font = { ...cell.font, underline: true };
                if (custom.color) cell.font = { ...cell.font, color: { argb: custom.color } };
                if (custom.decimal2) { cell.numFmt = "#,##0.00"; }
                if (custom.number) { cell.numFmt = "#,##0"; }
                if (custom.percent) { cell.numFmt = '0.00%'; }
            }
        });

        if (options.height) row.height = options.height;

        return row;
    };
    let totalLand = {
        formula: "",
        result: 0
    };
    let totalConstruction = {
        formula: "",
        result: 0
    };
    appraisalProperties?.forEach(appraisal => {
        appraisal.land?.forEach(item => {
            const price = appraisal.land?.[0].landType === item.landType ? appraisal.guidedPriceAverage : appraisal.guidedPriceAverage + Number(item.ontLandPrice) - Number(appraisal.land?.[0].ontLandPrice);
            totalLand.result += Math.round(price / 1000) * 1000 * item.landArea;
        });
    });

    constructionWorks?.forEach(w => {
        const money = w.area * w.unitPrice * parseFloat(w.qualityRemaining || 0) / 100;
        totalConstruction.result += money;
    });
    const landHeaderRow = addRow("I", "GIÁ TRỊ QUYỀN SỬ DỤNG ĐẤT", "", "", "", "", {
        bold: true,
        cellStyles: {
            6: {
                number: true
            }
        }
    });
    sheet.mergeCells(landHeaderRow.number, 2, landHeaderRow.number, 5);
    let counter = 1;
    appraisalProperties?.forEach(appraisal => {
        appraisal.land?.forEach(item => {
            const unitPrice = Math.round((appraisal.land?.[0].landType === item.landType ? Number(appraisal.guidedPriceAverage) : Number(appraisal.guidedPriceAverage) + Number(item.ontLandPrice) - Number(appraisal.land?.[0].ontLandPrice)) / 1000) * 1000;
            const areaCell = {
                formula: `'${appraisal.name}'!C${appraisalLandRowMaps[appraisal.id]?.[item.landType]?.areaRow}`,
                result: Number(item.landArea)
            };
            const unitPriceCell = {
                formula: `IF(C${sheet.lastRow.number + 1}="${appraisal.land?.[0].landType}", 'Điều chỉnh(${appraisal.name})'!${String.fromCharCode(68 + appraisal.selectedComparisons.length)}37, 'Điều chỉnh(${appraisal.name})'!${String.fromCharCode(68 + appraisal.selectedComparisons.length)}37+'${appraisal.name}'!C${appraisalLandRowMaps[appraisal.id]?.[item.landType]?.unitPriceRow}-'${appraisal.name}'!C${appraisalLandRowMaps[appraisal.id]?.[appraisal.land?.[0].landType]?.unitPriceRow})`,
                result: unitPrice
            };
            const totalCell = {
                formula: `D${sheet.lastRow.number + 1}*E${sheet.lastRow.number + 1}`,
                result: unitPrice * Number(item.landArea)
            };
            addRow(`1.${counter++}`, appraisal.location?.landParcel || "", item.landType, areaCell, unitPriceCell, totalCell, {
                cellStyles: {
                    4: { decimal2: true },
                    5: { number: true },
                    6: { number: true }
                }
            });
            totalLand.formula += `${totalLand.formula ? '+' : ''}F${sheet.lastRow.number}`;
        });
    });
    const totalCell = sheet.getCell(landHeaderRow.number, 6);
    totalCell.value = totalLand;
    let constructionHeaderRow;
    if (appraisalProperties?.some(app => app.currentUsageStatus && app.currentUsageStatus !== "Đất trống")) {
        constructionHeaderRow = addRow("II", "GIÁ TRỊ CÔNG TRÌNH XÂY DỰNG TRÊN ĐẤT", "", "", "", "", {
            bold: true,
            cellStyles: {
                6: { number: true }
            }
        });
        sheet.mergeCells(constructionHeaderRow.number, 2, constructionHeaderRow.number, 5);
        constructionWorks?.forEach((work, index) => {
            const constructionPrice = {
                formula: `C${sheet.lastRow.number + 1}*D${sheet.lastRow.number + 1}*E${sheet.lastRow.number + 1}`,
                result: work.area * work.unitPrice * parseFloat(work.qualityRemaining || 0) / 100
            }
            addRow(`2.${index + 1}`, work.description || "", work.qualityRemaining || "", Number(work.area), Number(work.unitPrice), constructionPrice, {
                cellStyles: {
                    4: { decimal2: true },
                    5: { number: true },
                    6: { number: true }
                }
            });
            totalConstruction.formula += `${totalConstruction.formula ? "+" : ""}F${sheet.lastRow.number}`
        });
        constructionHeaderRow.getCell(6).value = totalConstruction;
    }
    const hasConstruction = constructionWorks && constructionWorks.length > 0;
    const total = {
        formula: hasConstruction ? `F${landHeaderRow.number}+F${constructionHeaderRow.number}` : `F${landHeaderRow.number}`,
        result: totalLand.result + totalConstruction.result
    };
    const totalRow = addRow(`Tổng cộng${hasConstruction ? " (I+II)" : ""}`, "", "", "", "", total, {
        bold: true,
        cellStyles: {
            6: { number: true }
        }
    });
    sheet.mergeCells(totalRow.number, 1, totalRow.number, 5);
    sheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                wrapText: true
            };
            cell.font = { ...cell.font, name: "Times New Roman", size: 12 };
        });
    });
};