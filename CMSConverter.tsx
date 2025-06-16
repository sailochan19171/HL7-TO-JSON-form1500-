import React, { useState, useRef } from "react";
import { saveAs } from "file-saver";
import { useDropzone } from "react-dropzone";

interface HL7Json {
  [key: string]: { [key: string]: string } | undefined;
}

const CMSConverter: React.FC = () => {
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [hl7File, setHl7File] = useState<File | null>(null);
  const [hl7TextInput, setHl7TextInput] = useState<string>("");
  const [hl7Content, setHl7Content] = useState<string>("");
  const [jsonContent, setJsonContent] = useState<HL7Json | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setErrorMessage] = useState<string>("");
  const jsonDataRef = useRef<any>({});

  // JSON file dropzone
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
      setHl7File(null);
      setHl7TextInput("");
      console.log("JSON file set:", file.name);
    },
  });

  // HL7 file dropzone
  const {
    getRootProps: getHl7RootProps,
    getInputProps: getHl7InputProps,
    isDragActive: isHl7DragActive,
    isDragReject: isHl7DragReject,
  } = useDropzone({
    accept: { "text/plain": [".hl7", ".txt"] },
    maxFiles: 1,
    onDrop: (acceptedFiles, fileRejections) => {
      if (fileRejections.length > 0) {
        setErrorMessage("Invalid file. Please upload a single .hl7 or .txt file.");
        setHl7File(null);
        return;
      }
      const file = acceptedFiles[0];
      if (!file.name.endsWith(".hl7") && !file.name.endsWith(".txt")) {
        setErrorMessage("Invalid file type. Please upload a .hl7 or .txt file.");
        setHl7File(null);
        return;
      }
      setErrorMessage("");
      setHl7File(file);
      setJsonFile(null);
      setHl7Content("");
      setJsonContent(null);
      setHl7TextInput("");
      console.log("HL7 file set:", file.name);
    },
  });

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
    while (fields.length > 1 && fields[fields.length - 1] === '') {
      fields.pop();
    }
    return [segmentName, ...fields].join('|');
  };

  // Dynamic JSON to HL7 conversion
  const convertToHL7 = async (file: File): Promise<string> => {
    try {
      const text = await file.text();
      jsonDataRef.current = JSON.parse(text);
      const segments: string[] = [];
      jsonDataRef.current = jsonDataRef.current || {};

      // Define segment types and their field mappings dynamically
      const segmentDefinitions: { [key: string]: { field: string; index: number; transform?: (val: string) => string }[] } = {
        MSH: [
          { field: 'encodingCharacters', index: 1 },
          { field: 'sendingApplication', index: 2 },
          { field: 'sendingFacility', index: 3 },
          { field: 'receivingApplication', index: 4 },
          { field: 'receivingFacility', index: 5 },
          { field: 'dateTime', index: 6, transform: formatDate },
          { field: 'messageType', index: 8 },
          { field: 'controlId', index: 9 },
          { field: 'processingId', index: 10 },
          { field: 'versionId', index: 11 },
        ],
        PID: [
          { field: 'setId', index: 1 },
          { field: 'patientId', index: 3 },
          { field: 'patientName', index: 5 },
          { field: 'dob', index: 7, transform: formatDate },
          { field: 'gender', index: 8 },
          { field: 'address', index: 11 },
          { field: 'phoneNumber', index: 13 },
          { field: 'patientAccountNumber', index: 18 },
        ],
        PV1: [
          { field: 'setId', index: 1 },
          { field: 'patientClass', index: 2 },
          { field: 'attendingDoctor', index: 7 },
          { field: 'billingProviderPhone', index: 19 }, // Map billing provider phone to PV1-19
          { field: 'providerAddress', index: 44 }, // Map provider address to PV1-44
        ],
        PR1: [
          { field: 'setId', index: 1 },
          { field: 'procedureCode', index: 3 },
          { field: 'procedureDescription', index: 4 },
          { field: 'procedureDate', index: 5, transform: formatDate },
          { field: 'providerName', index: 11 },
        ],
        IN1: [
          { field: 'setId', index: 1 },
          { field: 'insurancePlan', index: 2 },
          { field: 'otherInsured', index: 3 },
          { field: 'insuranceId', index: 4 },
          { field: 'secondaryInsurancePlan', index: 5 },
          { field: 'healthBenefitPlan', index: 6 }, // Map health benefit plan to IN1-6
          { field: 'insuredName', index: 16 },
          { field: 'insuredDob', index: 18, transform: formatDate },
          { field: 'insuredAddress', index: 19 },
          { field: 'insuredPhoneNumber', index: 20 },
        ],
      };

      // Process each segment dynamically
      Object.entries(segmentDefinitions).forEach(([segmentName, fields]) => {
        const segmentData = jsonDataRef.current[segmentName];
        if (segmentData) {
          const segmentFields: string[] = Array(Math.max(...fields.map(f => f.index)) + 1).fill('');
          fields.forEach(({ field, index, transform }) => {
            let value = segmentData[field] || '';
            if (transform) {
              value = transform(value);
            }
            segmentFields[index] = value;
          });
          segments.push(createSegment(segmentName, segmentFields));
        }
      });

      // Handle OBX segments dynamically
      Object.keys(jsonDataRef.current)
        .filter(key => key.startsWith('OBX'))
        .sort((a, b) => {
          const aId = jsonDataRef.current[a]?.setId || a;
          const bId = jsonDataRef.current[b]?.setId || b;
          return aId.localeCompare(bId);
        })
        .forEach(obxKey => {
          const obxData = jsonDataRef.current[obxKey];
          const segmentFields = [
            obxData.setId || '',
            obxData.valueType || '',
            obxData.observationIdentifier || '',
            '',
            obxData.observationValue || '',
            '',
            '',
            '',
            '',
            '',
            obxData.observationStatus || '',
          ];
          segments.push(createSegment('OBX', segmentFields));
        });

      return segments.join('\n');
    } catch (err) {
      throw new Error(`JSON parsing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Dynamic HL7 to JSON conversion with specific field mappings
  const convertHL7ToJson = (hl7: string): HL7Json => {
    const jsonOutput: HL7Json = {};
    const lines = hl7.split("\n").filter(line => line.trim());

    // Define segment-specific field mappings for meaningful JSON keys
    const segmentFieldMappings: { [key: string]: { [key: string]: string } } = {
      MSH: {
        field1: 'encodingCharacters',
        field2: 'sendingApplication',
        field3: 'sendingFacility',
        field4: 'receivingApplication',
        field5: 'receivingFacility',
        field6: 'dateTime',
        field8: 'messageType',
        field9: 'controlId',
        field10: 'processingId',
        field11: 'versionId',
      },
      PID: {
        field1: 'setId',
        field3: 'patientId',
        field5: 'patientName',
        field7: 'dob',
        field8: 'gender',
        field11: 'address',
        field13: 'phoneNumber',
        field18: 'patientAccountNumber',
      },
      PV1: {
        field1: 'setId',
        field2: 'patientClass',
        field7: 'attendingDoctor',
        field19: 'billingProviderPhone', // Map PV1-19 to billingProviderPhone
        field44: 'providerAddress', // Map PV1-44 to providerAddress
      },
      PR1: {
        field1: 'setId',
        field3: 'procedureCode',
        field4: 'procedureDescription',
        field5: 'procedureDate',
        field11: 'providerName',
      },
      IN1: {
        field1: 'setId',
        field2: 'insurancePlan',
        field3: 'otherInsured',
        field4: 'insuranceId',
        field5: 'secondaryInsurancePlan',
        field6: 'healthBenefitPlan', // Map IN1-6 to healthBenefitPlan
        field16: 'insuredName',
        field18: 'insuredDob',
        field19: 'insuredAddress',
        field20: 'insuredPhoneNumber',
      },
      OBX: {
        field1: 'setId',
        field2: 'valueType',
        field3: 'observationIdentifier',
        field5: 'observationValue',
        field11: 'observationStatus',
      },
    };

    for (const line of lines) {
      const [segmentType, ...fields] = line.split("|");
      let segmentKey = segmentType;
      let segmentData: { [key: string]: string } = {};

      // Handle OBX segments with setId
      if (segmentType === "OBX" && fields[0]) {
        const setId = fields[0];
        segmentKey = `OBX${setId}`;
      }

      // Apply field mappings based on segment type
      const mappings = segmentFieldMappings[segmentType] || {};
      fields.forEach((field, index) => {
        const fieldKey = mappings[`field${index + 1}`] || `field${index + 1}`;
        segmentData[fieldKey] = field || "";
      });

      jsonOutput[segmentKey] = segmentData;
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
      setJsonContent(null);
    } catch (error) {
      setErrorMessage(`Failed to convert JSON to HL7: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConvertFromHl7 = async () => {
    let hl7Text = hl7TextInput;

    if (hl7File && !hl7Text) {
      try {
        hl7Text = await hl7File.text();
      } catch (error) {
        setErrorMessage(`Failed to read HL7 file: ${error instanceof Error ? error.message : "Unknown error"}`);
        setIsLoading(false);
        return;
      }
    }

    if (!hl7Text.trim()) {
      setErrorMessage("No HL7 content provided. Please paste HL7 text or upload an HL7 file.");
      return;
    }

    setIsLoading(true);
    try {
      const json = convertHL7ToJson(hl7Text);
      setJsonContent(json);
      setHl7Content("");
    } catch (error) {
      setErrorMessage(`Failed to convert HL7 to JSON: ${error instanceof Error ? error.message : "Unknown error"}`);
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



  // const handleDownloadJson = () => {
  //   try {
  //     if (jsonContent) {
  //       const jsonBlob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: "application/json" });
  //       saveAs(jsonBlob, "converted_from_hl7.json");
  //     }
  //   } catch (e) {
  //     console.error("Failed to download JSON:", e);
  //     setErrorMessage("Failed to download JSON file.");
  //   }
  // };


  // const handleDownloadJson = () => {
  //   try {
  //     if (jsonContent) {
  //       const jsonBlob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: "application/json" });
  //       saveAs(jsonBlob, "converted_from_hl7.json");
  //     }
  //   } catch (e) {
  //     console.error("Failed to download JSON:", e);
  //     setErrorMessage("Failed to download JSON file.");
  //   }
  // };

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
      maxWidth: "800px",
      margin: "2.5rem auto",
      padding: "1.5rem",
      border: "1px solid #e5e7eb",
      borderRadius: "0.75em",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" }}>
        CMS-1500 to HL7 and JSON Converter
      </h2>



      {/* JSON Input Section */}
      {/* <h3 style={{ fontSize: "1.125rem", fontWeight: "500", marginBottom: "0.75rem" }}>
        Convert CMS-1500 JSON to HL7
      </h3>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.75rem" }}>
        Drag and drop a JSON file with CMS-1500 data here or click to select one. Only JSON files are supported.
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
      <button
        onClick={() => jsonFile && handleConvertFromJson(jsonFile)}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: "0.25rem",
          cursor: isLoading || !jsonFile ? "not-allowed" : "pointer",
          opacity: isLoading || !jsonFile ? 0.5 : 1,
          marginBottom: "1.5rem",
        }}
        disabled={isLoading || !jsonFile}
      >
        {isLoading ? "Converting..." : "Convert JSON to HL7"}
      </button> */}
      


{/* JSON Input Section */}

      {/* JSON Input Section */}
      <h3 style={{ fontSize: "1.125rem", fontWeight: "500", marginBottom: "0.75rem" }}>
        Convert CMS-1500 JSON to HL7
      </h3>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.75rem" }}>
        Drag and drop a JSON file with CMS-1500 data here or click to select one. Only JSON files are supported.
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
      <button
        onClick={() => jsonFile && handleConvertFromJson(jsonFile)}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: "0.25rem",
          cursor: isLoading || !jsonFile ? "not-allowed" : "pointer",
          opacity: isLoading || !jsonFile ? 0.5 : 1,
          marginBottom: "1.5rem",
        }}
        disabled={isLoading || !jsonFile}
      >
        {isLoading ? "Converting..." : "Convert JSON to HL7"}
      </button>

      {/* HL7 Input Section */}
      <h3 style={{ fontSize: "1.125rem", fontWeight: "500", marginBottom: "0.75rem" }}>
        Convert HL7 to JSON
      </h3>
      <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.75rem" }}>
        Paste HL7 text below or upload an HL7 file (.hl7 or .txt).
      </p>
      <textarea
        value={hl7TextInput}
        onChange={(e) => setHl7TextInput(e.target.value)}
        placeholder="Paste HL7 text here..."
        style={{
          width: "100%",
          height: "150px",
          padding: "0.75rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.25rem",
          marginBottom: "1rem",
          fontSize: "0.875rem",
        }}
      />
    
      <div {...getHl7RootProps()} style={{
        border: "2px dashed #ccc",
        padding: "1.25rem",
        backgroundColor: isHl7DragActive ? "#e6f3ff" : isHl7DragReject ? "#ffe6e6" : "#f9fafb",
        marginBottom: "1rem",
        textAlign: "center",
      }}>
        <input {...getHl7InputProps()} />
        <p style={{ color: "#6b7280" }}>
          {isHl7DragActive
            ? "Drop the HL7 file here."
            : isHl7DragReject
            ? "Invalid file type. Please drop a .hl7 or .txt file."
            : "Drag an HL7 file here or click to select"}
        </p>
      </div>
      <button
      
        onClick={handleConvertFromHl7}
        style={{
          backgroundColor: "#2563eb",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: "0.25rem",
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.5 : 1,
          marginBottom: "1.5rem",
        }}
        disabled={isLoading}
      >
        {isLoading ? "Converting..." : "Convert HL7 to JSON"}
      </button>

      {error && <p style={{ color: "#ff0000", marginBottom: "0.75rem" }}>{error}</p>}




            {/* HL7 Output */}
      {/* {hl7Content && (
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
      )} */}


      {/* HL7 Output */}
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

      {/* JSON Output */}
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
