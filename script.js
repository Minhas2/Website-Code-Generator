
const csvFile = document.getElementById("csvFile");
const convertBtn = document.getElementById("convertBtn");
const showPrintPreviewBtn = document.getElementById("showPrintPreviewBtn");
const previewPdfBtn = document.getElementById("previewPdfBtn");
const printBtn = document.getElementById("printBtn");
const backBtn = document.getElementById("backBtn");

const statusMessage = document.getElementById("statusMessage");
const productsSection = document.getElementById("productsSection");
const printCustomizationSection = document.getElementById("printCustomizationSection");
const filledEntriesSection = document.getElementById("filledEntriesSection");

const productTableBody = document.getElementById("productTableBody");
const productCount = document.getElementById("productCount");

const printPagesContainer = document.getElementById("printPagesContainer");
const filledEntriesPagesContainer = document.getElementById("filledEntriesPagesContainer");

const costPriceCheckbox = document.getElementById("costPriceCheckbox");
const retailPriceCheckbox = document.getElementById("retailPriceCheckbox");
const discountPriceCheckbox = document.getElementById("discountPriceCheckbox");

const selectAllPricesBtn = document.getElementById("selectAllPricesBtn");
const deselectAllPricesBtn = document.getElementById("deselectAllPricesBtn");

const customColumnName = document.getElementById("customColumnName");
const addCustomColumnBtn = document.getElementById("addCustomColumnBtn");
const customColumnsList = document.getElementById("customColumnsList");
const selectedColumnCount = document.getElementById("selectedColumnCount");

const showFilledEntriesBtn = document.getElementById("showFilledEntriesBtn");
const backToCustomizationBtn = document.getElementById("backToCustomizationBtn");
const refreshFilledEntriesBtn = document.getElementById("refreshFilledEntriesBtn");
const printFilledEntriesBtn = document.getElementById("printFilledEntriesBtn");
const filledEntriesCount = document.getElementById("filledEntriesCount");

const strModeCheckbox = document.getElementById("strModeCheckbox");
const strModeActions = document.getElementById("strModeActions");
const generateStrTxtBtn = document.getElementById("generateStrTxtBtn");

const createPdfBtn = document.getElementById("createPdfBtn");
const createFilledPdfBtn = document.getElementById("createFilledPdfBtn");

const STORAGE_COLUMNS = "productSheetCustomColumns_v2";
const STORAGE_VALUES = "productSheetCustomValues_v2";
const STR_QUANTITY_KEY = "__strQuantity";

let products = [];
let customColumns = [];
let customValues = {};

// --------------------------------------------------
// LOAD AND SAVE DATA
// --------------------------------------------------

function loadSavedData() {
    try {
        const savedColumns = localStorage.getItem(STORAGE_COLUMNS);
        const savedValues = localStorage.getItem(STORAGE_VALUES);

        if (savedColumns) {
            const parsedColumns = JSON.parse(savedColumns);

            if (Array.isArray(parsedColumns)) {
                customColumns = parsedColumns.map((column, index) => {
                    if (typeof column === "string") {
                        return {
                            id: "column_" + index + "_" + Date.now(),
                            name: column
                        };
                    }

                    return {
                        id: String(column.id),
                        name: String(column.name)
                    };
                });
            }
        }

        if (savedValues) {
            const parsedValues = JSON.parse(savedValues);

            if (parsedValues && typeof parsedValues === "object") {
                customValues = parsedValues;
            }
        }
    } catch (error) {
        console.error("Could not load saved information:", error);
        customColumns = [];
        customValues = {};
    }
}

function saveCustomColumns() {
    try {
        localStorage.setItem(STORAGE_COLUMNS, JSON.stringify(customColumns));
    } catch (error) {
        alert("Could not save column settings in this browser.");
    }
}

function saveCustomValues() {
    try {
        localStorage.setItem(STORAGE_VALUES, JSON.stringify(customValues));
    } catch (error) {
        alert("Could not save your entries. Browser storage may be full.");
    }
}

// --------------------------------------------------
// GENERAL HELPERS
// --------------------------------------------------

function normalizeHeader(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[\s_\-()%]/g, "")
        .trim();
}

function findColumn(headers, possibleNames) {
    const normalizedHeaders = headers.map(header => normalizeHeader(header));

    for (const name of possibleNames) {
        const index = normalizedHeaders.indexOf(normalizeHeader(name));

        if (index !== -1) {
            return headers[index];
        }
    }

    return null;
}

function cleanValue(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function getNumericPrice(value) {
    if (value === null || value === undefined || value === "") return 0;

    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    const number = Number(cleaned);

    return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
    if (value === "" || value === null || value === undefined) return "";

    return Number(value).toLocaleString("en-PK", {
        maximumFractionDigits: 2
    });
}

function getProductKey(product) {
    return String(product.barcode || "") + "||" +
        String(product.name || "");
}

function getProductCustomValues(product) {
    const key = getProductKey(product);

    if (!customValues[key]) {
        customValues[key] = {};
    }

    return customValues[key];
}

function showStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = "status-message " + type;
}

function isStrModeEnabled() {
    return strModeCheckbox.checked;
}

function hasEnteredInformation(product) {
    const values = getProductCustomValues(product);

    const hasCustomEntry = customColumns.some(column => {
        return String(values[column.id] || "").trim() !== "";
    });

    const hasStrEntry = isStrModeEnabled() &&
        String(values[STR_QUANTITY_KEY] || "").trim() !== "";

    return hasCustomEntry || hasStrEntry;
}

// --------------------------------------------------
// STR MODE
// --------------------------------------------------

function updateStrMode() {
    const enabled = isStrModeEnabled();

    strModeActions.classList.toggle("hidden", !enabled);

    refreshPrintPreview();
}

strModeCheckbox.addEventListener("change", updateStrMode);

// --------------------------------------------------
// CSV IMPORT
// --------------------------------------------------

function importCSV() {
    const file = csvFile.files[0];

    if (!file) {
        showStatus("Please select a CSV file first.", "error");
        return;
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,

        complete: function (results) {
            if (!results.data || results.data.length === 0) {
                showStatus("The CSV file is empty or could not be read.", "error");
                return;
            }

            const headers = results.meta.fields || [];

            const barcodeColumn = findColumn(headers, [
                "Product Code", "Barcode", "Item Code", "ProductCode", "Code"
            ]);

            const nameColumn = findColumn(headers, [
                "Name", "Product Name", "Item Name", "ProductName", "ItemName"
            ]);

            const costColumn = findColumn(headers, [
                "Cost Price", "CostPrice", "Purchase Price"
            ]);

            const retailColumn = findColumn(headers, [
                "Price", "Retail Price", "Original Price", "RetailPrice", "OriginalPrice"
            ]);

            const discountColumn = findColumn(headers, [
                "Discount Price", "DiscountPrice", "Price After Discount",
                "After Discount Price", "PriceAfterDiscount", "AfterDiscountPrice"
            ]);

            if (!barcodeColumn || !nameColumn) {
                showStatus(
                    "Required columns not found. CSV must contain Product Code and Name.",
                    "error"
                );
                return;
            }

            if (!retailColumn || !discountColumn) {
                showStatus(
                    "Price columns not found. Check your CSV headings.",
                    "error"
                );
                return;
            }

            products = results.data.map(row => ({
                barcode: cleanValue(row[barcodeColumn]),
                name: cleanValue(row[nameColumn]),
                costPrice: costColumn ? getNumericPrice(row[costColumn]) : "",
                retailPrice: getNumericPrice(row[retailColumn]),
                discountPrice: getNumericPrice(row[discountColumn])
            })).filter(product => product.barcode || product.name);

            products.sort((a, b) => {
                if (a.discountPrice !== b.discountPrice) {
                    return a.discountPrice - b.discountPrice;
                }

                return a.name.localeCompare(b.name);
            });

            renderProducts();

            productsSection.classList.remove("hidden");
            printCustomizationSection.classList.add("hidden");
            filledEntriesSection.classList.add("hidden");

            showStatus(
                `Successfully imported ${products.length} products. Previously saved entries will be restored where product codes and names match.`,
                "success"
            );
        },

        error: function () {
            showStatus("There was an error reading the CSV file.", "error");
        }
    });
}

function renderProducts() {
    productTableBody.innerHTML = "";

    products.forEach(product => {
        const row = document.createElement("tr");

        const values = [
            product.barcode,
            product.name,
            product.costPrice === "" ? "" : formatPrice(product.costPrice),
            formatPrice(product.retailPrice),
            formatPrice(product.discountPrice)
        ];

        values.forEach(value => {
            const td = document.createElement("td");
            td.textContent = value;
            row.appendChild(td);
        });

        productTableBody.appendChild(row);
    });

    productCount.textContent = `${products.length} products`;
}

// --------------------------------------------------
// PRICE COLUMN SETTINGS
// --------------------------------------------------

function getPriceColumns() {
    return [
        { key: "costPrice", label: "Cost Price", checkbox: costPriceCheckbox },
        { key: "retailPrice", label: "Retail Price", checkbox: retailPriceCheckbox },
        { key: "discountPrice", label: "Price After Discount", checkbox: discountPriceCheckbox }
    ];
}

selectAllPricesBtn.addEventListener("click", () => {
    getPriceColumns().forEach(column => {
        column.checkbox.checked = true;
    });

    refreshPrintPreview();
});

deselectAllPricesBtn.addEventListener("click", () => {
    getPriceColumns().forEach(column => {
        column.checkbox.checked = false;
    });

    refreshPrintPreview();
});

// --------------------------------------------------
// CUSTOM COLUMNS
// --------------------------------------------------

function renderCustomColumns() {
    customColumnsList.innerHTML = "";

    customColumns.forEach(column => {
        const item = document.createElement("div");
        item.className = "custom-column-item";

        const name = document.createElement("span");
        name.textContent = column.name;

        const editButton = document.createElement("button");
        editButton.className = "small-btn edit-column-btn";
        editButton.textContent = "Edit Name";

        editButton.addEventListener("click", () => {
            const newName = prompt("Enter the new column heading:", column.name);

            if (newName === null) return;

            const trimmedName = newName.trim();

            if (!trimmedName) {
                alert("Column name cannot be empty.");
                return;
            }

            const duplicate = customColumns.some(existing =>
                existing.id !== column.id &&
                existing.name.toLowerCase() === trimmedName.toLowerCase()
            );

            if (duplicate) {
                alert("A column with this name already exists.");
                return;
            }

            column.name = trimmedName;

            saveCustomColumns();
            renderCustomColumns();
            refreshPrintPreview();
        });

        const removeButton = document.createElement("button");
        removeButton.className = "small-btn remove-column-btn";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", () => {
            const confirmed = confirm(
                `Remove "${column.name}" and all its saved cell entries?`
            );

            if (!confirmed) return;

            customColumns = customColumns.filter(
                existing => existing.id !== column.id
            );

            Object.keys(customValues).forEach(productKey => {
                if (customValues[productKey]) {
                    delete customValues[productKey][column.id];
                }
            });

            saveCustomColumns();
            saveCustomValues();

            renderCustomColumns();
            refreshPrintPreview();
        });

        item.appendChild(name);
        item.appendChild(editButton);
        item.appendChild(removeButton);

        customColumnsList.appendChild(item);
    });

    updateSelectedColumnCount();
}

function addCustomColumn() {
    const name = customColumnName.value.trim();

    if (!name) {
        alert("Please enter a column heading.");
        return;
    }

    const duplicate = customColumns.some(column =>
        column.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        alert("This column already exists.");
        return;
    }

    customColumns.push({
        id: "column_" + Date.now() + "_" +
            Math.random().toString(36).slice(2, 8),
        name: name
    });

    customColumnName.value = "";

    saveCustomColumns();
    renderCustomColumns();
    refreshPrintPreview();
}

addCustomColumnBtn.addEventListener("click", addCustomColumn);

customColumnName.addEventListener("keydown", event => {
    if (event.key === "Enter") addCustomColumn();
});

// --------------------------------------------------
// SELECTED PRINT COLUMNS
// --------------------------------------------------

function getSelectedColumns() {
    const columns = [
        { key: "barcode", label: "Barcode" },
        { key: "name", label: "Item Name" }
    ];

    getPriceColumns().forEach(column => {
        if (column.checkbox.checked) {
            columns.push({
                key: column.key,
                label: column.label
            });
        }
    });

    customColumns.forEach(column => {
        columns.push({
            key: column.id,
            label: column.name,
            blank: true
        });
    });

    if (isStrModeEnabled()) {
        columns.push({
            key: STR_QUANTITY_KEY,
            label: "STR Quantity",
            strQuantity: true
        });
    }

    return columns;
}

function updateSelectedColumnCount() {
    selectedColumnCount.textContent = getSelectedColumns().length;
}

// --------------------------------------------------
// BUILD PRINT PREVIEWS
// --------------------------------------------------

function buildPrintPreview(container, filtered = false) {
    container.innerHTML = "";

    if (products.length === 0) {
        container.textContent = "No products imported.";
        return 0;
    }

    const columns = getSelectedColumns();

    const shopName = document.getElementById("shopName").value.trim()
        || "Product Sheet";

    let displayProducts = products;

    if (filtered) {
        displayProducts = products.filter(product =>
            hasEnteredInformation(product)
        );
    }

    if (displayProducts.length === 0) {
        container.innerHTML = `
            <div class="empty-preview">
                <h3>No saved entries yet</h3>
                <p>Enter information into your custom columns or STR Quantity column first.</p>
            </div>
        `;

        return 0;
    }

    const rowsPerPage = 22;
    const totalPages = Math.ceil(displayProducts.length / rowsPerPage);

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const start = pageIndex * rowsPerPage;

        const pageProducts = displayProducts.slice(
            start,
            start + rowsPerPage
        );

        const page = document.createElement("div");
        page.className = "print-page";

        const heading = document.createElement("h2");
        heading.textContent = shopName;

        const subtitle = document.createElement("p");
        subtitle.className = "print-subtitle";

        subtitle.textContent = filtered
            ? `Saved Entries Sheet | Page ${pageIndex + 1} of ${totalPages}`
            : `Product Checking Sheet | Page ${pageIndex + 1} of ${totalPages}`;

        const table = document.createElement("table");

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        columns.forEach(column => {
            const th = document.createElement("th");
            th.textContent = column.label;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        pageProducts.forEach(product => {
            const row = document.createElement("tr");

            const productKey = getProductKey(product);
            const values = getProductCustomValues(product);

            columns.forEach(column => {
                const td = document.createElement("td");

                if (column.blank || column.strQuantity) {
                    const editor = document.createElement("div");

                    editor.className = "editable-cell";

                    if (column.strQuantity) {
                        editor.classList.add("str-quantity-cell");
                    }

                    editor.contentEditable = "true";
                    editor.spellcheck = false;
                    editor.textContent = values[column.key] || "";

                    editor.dataset.productKey = productKey;
                    editor.dataset.columnId = column.key;

                    td.appendChild(editor);

                } else if (
                    column.key === "retailPrice" ||
                    column.key === "discountPrice" ||
                    column.key === "costPrice"
                ) {
                    td.textContent = product[column.key] === ""
                        ? ""
                        : formatPrice(product[column.key]);

                } else {
                    td.textContent = product[column.key] || "";
                }

                row.appendChild(td);
            });

            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        page.appendChild(heading);
        page.appendChild(subtitle);
        page.appendChild(table);

        container.appendChild(page);
    }

    return displayProducts.length;
}

// --------------------------------------------------
// SAVE EDITED CELLS
// --------------------------------------------------

function handleCellEdit(event) {
    const editor = event.target.closest(".editable-cell");

    if (!editor) return;

    const productKey = editor.dataset.productKey;
    const columnId = editor.dataset.columnId;

    if (!productKey || !columnId) return;

    if (!customValues[productKey]) {
        customValues[productKey] = {};
    }

    customValues[productKey][columnId] = editor.innerText
        .replace(/\r/g, "")
        .trim();

    saveCustomValues();
    updateFilledEntriesCount();
}

printPagesContainer.addEventListener("input", handleCellEdit);
filledEntriesPagesContainer.addEventListener("input", handleCellEdit);

function refreshPrintPreview() {
    updateSelectedColumnCount();

    if (!printCustomizationSection.classList.contains("hidden")) {
        buildPrintPreview(printPagesContainer, false);
    }

    if (!filledEntriesSection.classList.contains("hidden")) {
        buildFilledEntriesPreview();
    }
}

// --------------------------------------------------
// SAVED ENTRIES PREVIEW
// --------------------------------------------------

function buildFilledEntriesPreview() {
    const count = buildPrintPreview(
        filledEntriesPagesContainer,
        true
    );

    filledEntriesCount.textContent =
        `${count} products with entered information`;
}

function updateFilledEntriesCount() {
    const count = products.filter(product =>
        hasEnteredInformation(product)
    ).length;

    filledEntriesCount.textContent =
        `${count} products with entered information`;
}

showFilledEntriesBtn.addEventListener("click", () => {
    buildFilledEntriesPreview();

    printCustomizationSection.classList.add("hidden");
    productsSection.classList.add("hidden");
    filledEntriesSection.classList.remove("hidden");
});

backToCustomizationBtn.addEventListener("click", () => {
    filledEntriesSection.classList.add("hidden");
    printCustomizationSection.classList.remove("hidden");
});

refreshFilledEntriesBtn.addEventListener("click", () => {
    buildFilledEntriesPreview();
});

// --------------------------------------------------
// GENERATE STR TXT
// --------------------------------------------------

function generateStrTxtFile() {
    if (!isStrModeEnabled()) {
        alert("Please enable STR Mode first.");
        return;
    }

    if (products.length === 0) {
        alert("Please import products first.");
        return;
    }

    const lines = [];
    const invalidProducts = [];

    products.forEach(product => {
        const values = getProductCustomValues(product);
        const quantity = String(values[STR_QUANTITY_KEY] || "").trim();

        if (quantity === "") return;

        if (!/^\d+$/.test(quantity) || Number(quantity) <= 0) {
            invalidProducts.push(product.barcode || product.name);
            return;
        }

        if (!product.barcode) {
            invalidProducts.push(product.name || "Product without barcode");
            return;
        }

        lines.push(`${product.barcode},${quantity}`);
    });

    if (invalidProducts.length > 0) {
        alert(
            "Please correct these STR entries before exporting:\n\n" +
            invalidProducts.join("\n") +
            "\n\nEnter a positive whole-number quantity for each product."
        );
        return;
    }

    if (lines.length === 0) {
        alert("No STR quantities entered yet.");
        return;
    }

    const blob = new Blob(
        [lines.join("\r\n")],
        { type: "text/plain;charset=utf-8" }
    );

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const shopName = document.getElementById("shopName").value.trim()
        || "STR";

    const safeShopName = shopName
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, "_");

    link.href = downloadUrl;
    link.download = `${safeShopName}_STR.txt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(downloadUrl);

    showStatus(
        `STR TXT generated successfully with ${lines.length} product entries.`,
        "success"
    );
}

generateStrTxtBtn.addEventListener("click", generateStrTxtFile);

// --------------------------------------------------
// CREATE PDF FROM PREVIEW
// --------------------------------------------------

async function createPreviewPDF(container, button, fileName) {
    if (typeof html2canvas === "undefined" ||
        typeof window.jspdf === "undefined") {
        alert("PDF libraries did not load. Please check your internet connection and refresh the page.");
        return;
    }

    const pages = Array.from(
        container.querySelectorAll(".print-page")
    );

    if (pages.length === 0) {
        alert("There are no preview pages to convert into PDF.");
        return;
    }

    const originalButtonText = button.textContent;

    button.disabled = true;
    button.textContent = "Creating PDF...";

    try {
        // Save any active cell edit before capturing the pages.
        if (document.activeElement &&
            document.activeElement.classList.contains("editable-cell")) {
            document.activeElement.blur();
        }

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        for (let i = 0; i < pages.length; i++) {
            button.textContent = `Creating PDF ${i + 1}/${pages.length}...`;

            const canvas = await html2canvas(pages[i], {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                width: pages[i].scrollWidth,
                height: pages[i].scrollHeight
            });

            const imageData = canvas.toDataURL("image/jpeg", 0.95);

            if (i > 0) {
                pdf.addPage("a4", "portrait");
            }

            pdf.addImage(
                imageData,
                "JPEG",
                0,
                0,
                210,
                297,
                undefined,
                "FAST"
            );

            // Release the page canvas memory before moving on.
            canvas.width = 1;
            canvas.height = 1;
        }

        pdf.save(fileName);

        showStatus(
            `${fileName} created successfully with ${pages.length} page(s).`,
            "success"
        );

    } catch (error) {
        console.error("PDF creation error:", error);

        alert(
            "Could not create the PDF. Please try again with fewer products or check the browser console."
        );

    } finally {
        button.disabled = false;
        button.textContent = originalButtonText;
    }
}

function getSafeFileName(suffix) {
    const shopName = document.getElementById("shopName").value.trim()
        || "Product_Sheet";

    const safeShopName = shopName
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, "_");

    return `${safeShopName}_${suffix}.pdf`;
}

// Full product sheet PDF
createPdfBtn.addEventListener("click", async () => {
    buildPrintPreview(printPagesContainer, false);

    await createPreviewPDF(
        printPagesContainer,
        createPdfBtn,
        getSafeFileName("Full_Product_Sheet")
    );
});

// Saved entries PDF
createFilledPdfBtn.addEventListener("click", async () => {
    buildFilledEntriesPreview();

    const hasSavedEntries = products.some(product =>
        hasEnteredInformation(product)
    );

    if (!hasSavedEntries) {
        alert("There are no saved entries to create a PDF from.");
        return;
    }

    await createPreviewPDF(
        filledEntriesPagesContainer,
        createFilledPdfBtn,
        getSafeFileName("Saved_Entries")
    );
});

// --------------------------------------------------
// NAVIGATION
// --------------------------------------------------

showPrintPreviewBtn.addEventListener("click", () => {
    if (products.length === 0) {
        alert("Please import products first.");
        return;
    }

    productsSection.classList.add("hidden");
    filledEntriesSection.classList.add("hidden");
    printCustomizationSection.classList.remove("hidden");

    renderCustomColumns();
    updateStrMode();
    buildPrintPreview(printPagesContainer, false);
});

backBtn.addEventListener("click", () => {
    printCustomizationSection.classList.add("hidden");
    productsSection.classList.remove("hidden");
});

// --------------------------------------------------
// PRICE CHECKBOX EVENTS
// --------------------------------------------------

getPriceColumns().forEach(column => {
    column.checkbox.addEventListener("change", refreshPrintPreview);
});

previewPdfBtn.addEventListener("click", () => {
    buildPrintPreview(printPagesContainer, false);
});

// --------------------------------------------------
// PRINTING
// --------------------------------------------------

function startPrinting(target) {
    const container = target === "all"
        ? printPagesContainer
        : filledEntriesPagesContainer;

    if (!container ||
        container.querySelectorAll(".print-page").length === 0) {
        alert("There are no printable product pages.");
        return;
    }

    document.body.dataset.printTarget = target;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.print();
        });
    });
}

printBtn.addEventListener("click", () => {
    if (products.length === 0) {
        alert("There are no products to print.");
        return;
    }

    buildPrintPreview(printPagesContainer, false);
    startPrinting("all");
});

printFilledEntriesBtn.addEventListener("click", () => {
    buildFilledEntriesPreview();

    const hasSavedEntries = products.some(product =>
        hasEnteredInformation(product)
    );

    if (!hasSavedEntries) {
        alert("There are no saved entries to print yet.");
        return;
    }

    startPrinting("filled");
});

window.addEventListener("afterprint", () => {
    delete document.body.dataset.printTarget;
});

// --------------------------------------------------
// INITIAL SETUP
// --------------------------------------------------

loadSavedData();
renderCustomColumns();
updateSelectedColumnCount();

convertBtn.addEventListener("click", importCSV);
