import React, { useState, useRef } from "react";
import { saveAs } from "file-saver";
import { useDropzone } from "react-dropzone";

interface HL7Json {
  [key: string]: { [key: string]: string } | undefined;
}

interface FieldMapping {
  path?: string;
  value?: string;
  transform?: (val: string, data?: any) => string;
}

const CMSConverter: React.FC = () => {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [hl7Content, setHl7Content] = useState<string>("");
  const [jsonContent, setJsonContent] = useState<HL7Json | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setErrorMessage] = useState<string>("");
  const jsonDataRef = useRef<any>({});

  const {
    getRootProps: getJsonRootProps,
    getInputProps: getJsonInputProps,
    isDragActive: isJsonDragActive,
    isDragReject: isJsonDragReject,
  } = useDropzone({
    accept: { "application/json": [".json"] },
    maxFiles: 1,
    onDrop: (acceptedFiles, fileRejections) => {
      if (fileRejections.length > 0) {
        setErrorMessage("Invalid file. Please upload a single .json file.");
        setJsonFile(null);
        return;
      }
      const file = acceptedFiles[0];
      if (!file.name.endsWith(".json")) {
        setErrorMessage("Invalid file type. Please upload a .json file.");
        setJsonFile(null);
        return;
      }
      setErrorMessage("");
      setJsonFile(file);
      setHl7Content("");
      setJsonContent(null);
      console.log("JSON file set:", file.name);
    },
  });

  // Utility to safely get nested JSON values
  const getNestedValue = (obj: any, path: string): string => {
    return path.split('.').reduce((current, key) => current ? current[key] : '', obj) || '';
  };

  // Utility to format date (YYYYMMDD or fallback to empty string)
  const formatDate = (dateStr: string): string => {
    if (dateStr && /^\d{8}$/.test(dateStr)) return dateStr;
    if (dateStr && /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.test(dateStr)) {
      const [, month, day, year] = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)!;
      return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
    }
    return '';
  };

  // Utility to create an HL7 segment
  const createSegment = (segmentName: string, fields: string[]): string => {
    // Remove trailing empty fields
    while (fields.length > 1 && fields[fields.length - 1] === '') {
      fields.pop();
    }
    return [segmentName, ...fields].join('|');
  };

  // HL7 segment mappings (no hardcoded values)
  const hl7Mappings: Record<string, FieldMapping[]> = {
    MSH: [
      { path: 'MSH.encodingCharacters' }, // MSH-1
      { value: '' }, // MSH-2 (already in MSH-1)
      { path: 'MSH.sendingApplication' }, // MSH-3
      { path: 'MSH.sendingFacility' }, // MSH-4
      { path: 'MSH.receivingApplication' }, // MSH-5
      { path: 'MSH.receivingFacility' }, // MSH-6
      { path: 'MSH.dateTime', transform: formatDate }, // MSH-7
      { value: '' }, // MSH-8
      { path: 'MSH.messageType' }, // MSH-9
      { path: 'MSH.controlId' }, // MSH-10
      { path: 'MSH.processingId' }, // MSH-11
      { path: 'MSH.versionId' }, // MSH-12
    ],
    PID: [
      { path: 'PID.setId' }, 
      { value: '' }, 
      { path: 'PID.patientId' }, 
      { value: '' }, 
      { path: 'PID.patientName' }, 
      { value: '' },
      { path: 'PID.dob', transform: formatDate }, 
      { path: 'PID.gender' }, 
      { value: '' }, 
      { value: '' }, 
      { path: 'PID.address' }, 
      { value: '' }, 
      { path: 'PID.phoneNumber' }, 
      { value: '' }, 
      { value: '' },
      { value: '' }, 
      { value: '' }, 
      { path: 'PID.patientAccountNumber' }, 
    ],
    PV1: [
      { path: 'PV1.setId' }, 
      { path: 'PV1.patientClass' }, 
      { value: '' },
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { path: 'PV1.attendingDoctor' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { path: 'PV1.providerPhoneNumber' }, 
    ],
    PR1: [
      { path: 'PR1.setId' }, 
      { value: '' }, 
      { path: 'PR1.procedureCode' }, 
      { path: 'PR1.procedureDescription' }, 
      { path: 'PR1.procedureDate', transform: formatDate }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { value: '' }, 
      { path: 'PR1.providerName' }, // PR1-11
    ],
    IN1: [
      { path: 'IN1.setId' }, // IN1-1
      { path: 'IN1.insurancePlan' }, // IN1-2
      { path: 'IN1.otherInsured' }, // IN1-3
      { path: 'IN1.insuranceId' }, // IN1-4
      { path: 'IN1.secondaryInsurancePlan' }, // IN1-5
      { value: '' }, // IN1-6
      { value: '' }, // IN1-7
      { value: '' }, // IN1-8
      { value: '' }, // IN1-9
      { value: '' }, // IN1-10
      { value: '' }, // IN1-11
      { value: '' }, // IN1-12
      { value: '' }, // IN1-13
      { value: '' }, // IN1-14
      { value: '' }, // IN1-15
      { path: 'IN1.insuredName' }, // IN1-16
      { value: '' }, // IN1-17
      { path: 'IN1.insuredDob', transform: formatDate }, // IN1-18
      { path: 'IN1.insuredAddress' }, // IN1-19
      { path: 'IN1.insuredPhoneNumber' }, // IN1-20
    ],
    // OBX segments will be handled dynamically below
  };

  const convertToHL7 = async (file: File): Promise<string> => {
    try {
      const text = await file.text();
      jsonDataRef.current = JSON.parse(text);

      const segments: string[] = [];

      // Generate standard segments (MSH, PID, PV1, PR1, IN1)
      Object.entries(hl7Mappings).forEach(([segmentName, fields]) => {
        const segmentFields = fields.map(field => {
          let value = field.path ? getNestedValue(jsonDataRef.current, field.path) : field.value || '';
          if (field.transform) {
            value = field.transform(value, jsonDataRef.current);
          }
          return value;
        });
        segments.push(createSegment(segmentName, segmentFields));
      });

      // Handle OBX segments dynamically (OBX, OBX1, OBX3, etc.)
      Object.keys(jsonDataRef.current)
        .filter(key => key.startsWith('OBX'))
        .sort((a, b) => {
          // Sort OBX keys (OBX, OBX1, OBX3, etc.) by setId or key
          const aId = jsonDataRef.current[a]?.setId || a;
          const bId = jsonDataRef.current[b]?.setId || b;
          return aId.localeCompare(bId);
        })
        .forEach(obxKey => {
          const obxData = jsonDataRef.current[obxKey];
          const segmentFields = [
            getNestedValue(obxData, 'setId'), // OBX-1
            getNestedValue(obxData, 'valueType'), // OBX-2
            getNestedValue(obxData, 'observationIdentifier'), // OBX-3
            '', // OBX-4
            getNestedValue(obxData, 'observationValue'), // OBX-5
            '', // OBX-6
            '', // OBX-7
            '', // OBX-8
            '', // OBX-9
            '', // OBX-10
            getNestedValue(obxData, 'observationStatus'), // OBX-11
          ];
          segments.push(createSegment('OBX', segmentFields));
        });

      return segments.join('\n');
    } catch (err) {
      throw new Error(`JSON parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const convertHL7ToJson = (hl7: string): HL7Json => {
    const jsonOutput: HL7Json = {};
    const lines = hl7.split("\n").filter(line => line.trim());

    for (const line of lines) {
      const [segmentType, ...fields] = line.split("|");
      if (!jsonOutput[segmentType]) {
        jsonOutput[segmentType] = {};
      }

      switch (segmentType) {
        case "MSH":
          jsonOutput[segmentType] = {
            encodingCharacters: fields[0] || "",
            sendingApplication: fields[1] || "",
            sendingFacility: fields[2] || "",
            receivingApplication: fields[3] || "",
            receivingFacility: fields[4] || "",
            dateTime: fields[5] || "",
            messageType: fields[7] || "",
            controlId: fields[8] || "",
            processingId: fields[9] || "",
            versionId: fields[10] || "",
          };
          break;
        case "PID":
          jsonOutput[segmentType] = {
            setId: fields[0] || "",
            patientId: fields[2] || "",
            patientName: fields[4] || "",
            dob: fields[6] || "",
            gender: fields[7] || "",
            address: fields[10] || "",
            phoneNumber: fields[12] || "",
            patientAccountNumber: fields[17] || "",
          };
          break;
        case "PV1":
          jsonOutput[segmentType] = {
            setId: fields[0] || "",
            patientClass: fields[1] || "",
            attendingDoctor: fields[6] || "",
            providerPhoneNumber: fields[18] || "",
          };
          break;
        case "PR1":
          jsonOutput[segmentType] = {
            setId: fields[0] || "",
            procedureCode: fields[2] || "",
            procedureDescription: fields[3] || "",
            procedureDate: fields[4] || "",
            providerName: fields[10] || "",
          };
          break;
        case "IN1":
          jsonOutput[segmentType] = {
            setId: fields[0] || "",
            insurancePlan: fields[1] || "",
            otherInsured: fields[2] || "",
            insuranceId: fields[3] || "",
            secondaryInsurancePlan: fields[4] || "",
            insuredName: fields[15] || "",
            insuredDob: fields[17] || "",
            insuredAddress: fields[18] || "",
            insuredPhoneNumber: fields[19] || "",
          };
          break;
        case "OBX":
          const setId = fields[0] || "0";
          jsonOutput[`OBX${setId === '0' ? '' : setId}`] = {
            setId: fields[0] || "",
            valueType: fields[1] || "",
            observationIdentifier: fields[2] || "",
            observationValue: fields[4] || "",
            observationStatus: fields[10] || "",
          };
          break;
        default:
          jsonOutput[segmentType] = fields.reduce((acc: { [key: string]: string }, field, index) => {
            acc[`field${index}`] = field;
            return acc;
          }, {});
      }
    }

    return jsonOutput;
  };

  const handleConvertFromJson = async (file: File) => {
    if (!file) {
      setErrorMessage("No JSON file selected. Please upload a valid JSON file.");
      return;
    }

    setIsLoading(true);
    try {
      const hl7 = await convertToHL7(file);
      setHl7Content(hl7);
      const json = convertHL7ToJson(hl7);
      setJsonContent(json);
    } catch (error) {
      setErrorMessage(`Failed to convert JSON to HL7: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadHL7 = () => {
    try {
      if (hl7Content) {
        const hl7Blob = new Blob([hl7Content], { type: "text/plain; charset=utf-8" });
        saveAs(hl7Blob, "converted_from_json.hl7");
      }
    } catch (e) {
      console.error("Failed downloading HL7:", e);
      setErrorMessage("Failed to download HL7 file.");
    }
  };

  const handleDownloadJson = () => {
    try {
      if (jsonContent) {
        const jsonBlob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: "application/json" });
        saveAs(jsonBlob, "converted_from_hl7.json");
      }
    } catch (e) {
      console.error("Failed to download JSON:", e);
      setErrorMessage("Failed to download JSON file.");
    }
  };

  return (
    <div style={{
      maxWidth: "600px",
      margin: "2.5rem auto",
      padding: "1.5rem",
      border: "1px solid #e5e7eb",
      borderRadius: "0.75em",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem" }}>
        JSON to HL7 Converter
      </h2>

      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.75rem" }}>
        Drag and drop a JSON file here or click to select one. Only JSON files are supported.
      </p>
      <div {...getJsonRootProps()} style={{
        border: "2px dashed #ccc",
        padding: "1.25rem",
        backgroundColor: isJsonDragActive ? "#e6f3ff" : isJsonDragReject ? "#ffe6e6" : "#f9fafb",
        marginBottom: "1rem",
        textAlign: "center",
      }}>
        <input {...getJsonInputProps()} />
        <p style={{ color: "#6b7280" }}>
          {isJsonDragActive
            ? "Drop the JSON file here."
            : isJsonDragReject
            ? "Invalid file type. Please drop a JSON file."
            : "Drag a JSON file here or click to select"}
        </p>
      </div>

      {error && <p style={{ color: "#ff0000", marginBottom: "0.75rem" }}>{error}</p>}

      <button
        onClick={() => {
          console.log("Convert button clicked - jsonFile:", jsonFile ? jsonFile.name : "");
          if (jsonFile) handleConvertFromJson(jsonFile);
        }}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: "0.25rem",
          cursor: isLoading || !jsonFile ? "not-allowed" : "pointer",
          opacity: isLoading || !jsonFile ? 0.5 : 1,
          marginBottom: "1rem",
        }}
        disabled={isLoading || !jsonFile}
      >
        {isLoading ? "Converting..." : "Convert"}
      </button>

      {hl7Content && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: "500", marginBottom: "1rem" }}>
            HL7 Output
          </h3>
          <pre style={{
            padding: "1rem",
            backgroundColor: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: "0.25rem",
            fontSize: "0.875rem",
            overflowX: "auto",
          }}>
            {hl7Content}
          </pre>
          <button
            onClick={handleDownloadHL7}
            style={{
              backgroundColor: "#10b981",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              cursor: "pointer",
              marginTop: "0.5rem",
            }}
          >
            Download HL7
          </button>
        </div>
      )}

      {jsonContent && (
        <div style={{ marginTop: "1.25rem" }}>
          <h3 style={{ fontSize: "1.125rem", fontWeight: "500", marginBottom: "1rem" }}>
            JSON Output
          </h3>
          <pre style={{
            padding: "1rem",
            backgroundColor: "#f3f4f6",
            border: "1px solid #e5e7eb",
            borderRadius: "0.25rem",
            fontSize: "0.875rem",
            overflowX: "auto",
          }}>
            {JSON.stringify(jsonContent, null, 2)}
          </pre>
          <button
            onClick={handleDownloadJson}
            style={{
              backgroundColor: "#10b981",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              cursor: "pointer",
              marginTop: "0.5rem",
            }}
          >
            Download JSON
          </button>
        </div>
      )}
    </div>
  );
};

export default CMSConverter;
