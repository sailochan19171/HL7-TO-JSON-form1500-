import React, {useState} from "react";

function CMSConverter() {
    const [inputText, setInputText] = useState("");
    const [hl7, setHL7] = useState("");
    
    const parseCMS1500Text = (text: string): Record<string, string> => {
        const data: Record<string, string> = {};
        text.split("\n").forEach((line) => {
            const [key, value] = line.split(":");
            if (key && value) {
                data[key.trim()] = value.trim();
            }
        });
        return data;
    };

    const toHl7Format = (data: Record<string, string>) => {
        const HL7_SEGMENTS = [
            `MSH|^~\\&|CMS1500App|Hospital|HL7Receiver|HL7Facility|${new Date().toISOString()}||ADT^A01|MSG00001|P|2.5`,
            `PID|||${data.insurance_id || ""}||${data.pt_name || ""}||${data.birth_yy || ""}${data.birth_mm || ""}${data.birth_dd || ""}|${data.sex?.charAt(0) || ""}|||${data.pt_city || ""}^${data.pt_state || ""}`,
            `IN1|||${data.insurance_name || ""}||${data.insurance_id || ""}`,
            `PV1||O|Clinic||||${data.physician_signature || ""}|||||||||||${data.physician_date || ""}`
        ];
        return HL7_SEGMENTS.join("\n");
    };
    
    const handleConvertClick = () => {
        const parsedData = parseCMS1500Text(inputText);
        const hl7format = toHl7Format(parsedData);
        setHL7(hl7format);
    };
    
    const downloadTextFile = () => {
        const blob = new Blob([hl7], {type: "text/plain"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "cms1500_data";
        a.click();
        URL.revokeObjectURL(url);
    };
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (typeof reader.result === 'string') {
                    setInputText(reader.result);
                }
            };
            reader.readAsText(file);
        }
    };
    
    return (
        <div style={{maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto', padding: "2rem", fontFamily: "sans-serif"}}>
            <h1 style={{fontSize: "24px", fontWeight: "bold", marginBottom: "1rem"}}>CMS-1500 TO HL7 CONVERTER</h1>
            <div style={{marginBottom: "1rem"}}>
                <label><strong>or paste/edit content below</strong></label>
                <textarea
                    rows={10}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    style={{
                        width: "100%", 
                        padding: "0.5rem", 
                        borderRadius: "4px", 
                        border: "1px solid #ccc", 
                        marginTop: "0.5rem"
                    }}
                />
            </div>
            <div style={{display: "flex", gap: "1rem", marginBottom: "1rem"}}>
                <button 
                    onClick={handleConvertClick}
                    style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                    }}
                >
                    Convert to HL7
                </button>
                <button 
                    onClick={downloadTextFile}
                    style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#2196F3",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                    }}
                >
                    Download HL7
                </button>
                <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    style={{marginTop: "0.5rem"}}
                />
            </div>
            <div style={{marginTop: "1rem"}}>
                <h2 style={{fontSize: "18px", fontWeight: "bold", marginBottom: "0.5rem"}}>HL7 Output:</h2>
                <pre style={{
                    backgroundColor: "#f5f5f5",
                    padding: "1rem",
                    borderRadius: "4px",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto"
                }}>
                    {hl7 || "HL7 output will appear here after conversion"}
                </pre>
            </div>
        </div>
    );
}

export default CMSConverter;