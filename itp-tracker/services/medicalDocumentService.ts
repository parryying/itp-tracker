/**
 * Medical Document Intelligence Service
 *
 * Analyzes ANY medical document using GPT-4o Vision:
 * - Lab reports (CBC, metabolic panels, immunology)
 * - Doctor's visit notes / progress notes
 * - Visit summaries / after-visit summaries
 * - Discharge summaries
 * - Medication lists / prescription changes
 * - Imaging/radiology reports
 * - Pathology reports
 * - Insurance/billing summaries
 *
 * Extracts structured data, categorizes, and stores for charting.
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────

export type DocumentCategory =
  | 'lab_results'
  | 'visit_notes'
  | 'visit_summary'
  | 'discharge_summary'
  | 'medication_list'
  | 'imaging_report'
  | 'pathology_report'
  | 'referral'
  | 'other';

export interface ExtractedLabValue {
  name: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: 'critical' | 'warning' | 'normal';
}

export interface ExtractedMedication {
  name: string;
  dose: string;
  frequency: string;
  status: 'active' | 'discontinued' | 'changed' | 'new';
  notes?: string;
}

export interface ExtractedVitalSign {
  name: string;
  value: string;
  unit: string;
}

export interface ExtractedDiagnosis {
  name: string;
  icdCode?: string;
  status: 'active' | 'resolved' | 'monitoring';
}

export interface ExtractedNote {
  provider: string;
  specialty: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  followUp?: string;
}

export interface DocumentExtractionResult {
  id: string;
  category: DocumentCategory;
  categoryLabel: string;
  date: string;            // Date of the document/visit
  uploadDate: string;      // When user uploaded it
  provider?: string;       // Hospital/doctor name
  title: string;           // Auto-generated title
  summary: string;         // Plain language summary
  imageUri: string;        // Local file path of original image

  // Extracted structured data (populated based on category)
  labValues?: ExtractedLabValue[];
  medications?: ExtractedMedication[];
  vitals?: ExtractedVitalSign[];
  diagnoses?: ExtractedDiagnosis[];
  notes?: ExtractedNote;

  // Raw AI response for debugging
  rawResponse?: string;
}

// ─── Storage ─────────────────────────────────────────────────────────
const DOCS_KEY = 'medical_documents';
const LABS_FROM_DOCS_KEY = 'labs_from_documents';

// ─── Azure OpenAI Config ─────────────────────────────────────────────
const CONFIG = {
  endpoint: process.env.EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT || '',
  apiKey: process.env.EXPO_PUBLIC_AZURE_OPENAI_KEY || '',
  deployment: process.env.EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  apiVersion: '2024-10-21',
};

// ─── System Prompt ───────────────────────────────────────────────────
const DOCUMENT_ANALYSIS_PROMPT = `You are a medical document analysis AI for a patient with Immune Thrombocytopenia (ITP). 
Analyze the provided medical document image and extract ALL relevant information.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanation outside JSON.

Return this exact JSON structure:
{
  "category": "lab_results" | "visit_notes" | "visit_summary" | "discharge_summary" | "medication_list" | "imaging_report" | "pathology_report" | "referral" | "other",
  "categoryLabel": "Human readable category name",
  "date": "YYYY-MM-DD or best guess from document",
  "provider": "Hospital or doctor name if visible",
  "title": "Brief descriptive title (e.g., 'CBC with Differential - Seattle Children\\'s')",
  "summary": "2-3 sentence plain language summary of KEY findings relevant to ITP patient",
  
  "labValues": [
    {
      "name": "Test name (e.g., Platelets, WBC, Hemoglobin)",
      "value": 28,
      "unit": "k/µL",
      "referenceRange": "150-400",
      "status": "critical" | "warning" | "normal"
    }
  ],
  
  "medications": [
    {
      "name": "Drug name",
      "dose": "Dose with units",
      "frequency": "How often",
      "status": "active" | "discontinued" | "changed" | "new",
      "notes": "Any relevant notes"
    }
  ],
  
  "vitals": [
    {
      "name": "Vital sign name",
      "value": "Value",
      "unit": "Unit"
    }
  ],
  
  "diagnoses": [
    {
      "name": "Diagnosis",
      "icdCode": "ICD code if visible",
      "status": "active" | "resolved" | "monitoring"
    }
  ],
  
  "notes": {
    "provider": "Doctor/NP name",
    "specialty": "Specialty (e.g., Hematology, Pediatrics)",
    "summary": "Key points from the note",
    "keyFindings": ["Finding 1", "Finding 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"],
    "followUp": "Follow-up instructions if any"
  }
}

RULES:
- For lab_results: Focus on extracting ALL lab values with exact numbers, units, and reference ranges
- For visit_notes/summaries: Extract medications, vitals, diagnoses, and key recommendations
- For ITP patients, ALWAYS flag platelet counts and note severity (critical < 30k, warning < 50k)
- Omit empty arrays/objects — only include sections that have data
- For status on labs: "critical" if dangerously out of range, "warning" if mildly abnormal, "normal" if within range
- If you can't determine a field, omit it rather than guessing
- Date should be extracted from the document, not today's date`;

// ─── Service ─────────────────────────────────────────────────────────
export class MedicalDocumentService {

  /**
   * Analyze a medical document image using GPT-4o Vision
   */
  static async analyzeDocument(imageUri: string): Promise<DocumentExtractionResult> {
    // Read image as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Determine MIME type
    const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    // Call GPT-4o Vision
    const url = `${CONFIG.endpoint}/openai/deployments/${CONFIG.deployment}/chat/completions?api-version=${CONFIG.apiVersion}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': CONFIG.apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: DOCUMENT_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this medical document. Extract all information and return structured JSON.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Document analysis failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (strip any markdown code blocks)
    let parsed: any;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Failed to parse AI response. Please try a clearer image.');
    }

    // Build result
    const result: DocumentExtractionResult = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      category: parsed.category || 'other',
      categoryLabel: parsed.categoryLabel || 'Document',
      date: parsed.date || new Date().toISOString().split('T')[0],
      uploadDate: new Date().toISOString(),
      provider: parsed.provider,
      title: parsed.title || 'Medical Document',
      summary: parsed.summary || '',
      imageUri,
      labValues: parsed.labValues,
      medications: parsed.medications,
      vitals: parsed.vitals,
      diagnoses: parsed.diagnoses,
      notes: parsed.notes,
      rawResponse: rawContent,
    };

    // Save to storage
    await this.saveDocument(result);

    // If it has lab values, merge into lab history
    if (result.labValues && result.labValues.length > 0) {
      await this.mergeLabsIntoHistory(result);
    }

    return result;
  }

  /**
   * Analyze multiple images (e.g., multi-page document)
   */
  static async analyzeMultipleImages(imageUris: string[]): Promise<DocumentExtractionResult[]> {
    const results: DocumentExtractionResult[] = [];
    for (const uri of imageUris) {
      try {
        const result = await this.analyzeDocument(uri);
        results.push(result);
      } catch (error) {
        console.error('Failed to analyze image:', uri, error);
      }
    }
    return results;
  }

  // ─── Storage Operations ──────────────────────────────────────────

  /**
   * Save a document extraction result
   */
  static async saveDocument(doc: DocumentExtractionResult): Promise<void> {
    const existing = await this.getAllDocuments();
    existing.unshift(doc); // newest first
    await AsyncStorage.setItem(DOCS_KEY, JSON.stringify(existing));
  }

  /**
   * Get all saved documents
   */
  static async getAllDocuments(): Promise<DocumentExtractionResult[]> {
    try {
      const raw = await AsyncStorage.getItem(DOCS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get documents by category
   */
  static async getDocumentsByCategory(category: DocumentCategory): Promise<DocumentExtractionResult[]> {
    const all = await this.getAllDocuments();
    return all.filter(d => d.category === category);
  }

  /**
   * Get all lab values from documents, grouped by date for charting
   */
  static async getLabHistory(): Promise<{
    labSets: Array<{
      date: string;
      isNew: boolean;
      panels: Array<{
        name: string;
        items: ExtractedLabValue[];
      }>;
    }>;
    plateletHistory: Array<{ date: string; value: number }>;
  }> {
    const docs = await this.getAllDocuments();
    const labDocs = docs.filter(d => d.labValues && d.labValues.length > 0);

    // Group lab values by date → panel
    const byDate = new Map<string, Map<string, ExtractedLabValue[]>>();
    const plateletHistory: { date: string; value: number }[] = [];

    for (const doc of labDocs) {
      const dateStr = new Date(doc.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      if (!byDate.has(dateStr)) byDate.set(dateStr, new Map());
      const panels = byDate.get(dateStr)!;

      for (const lab of doc.labValues!) {
        // Determine panel
        const panel = this.getPanel(lab.name);
        if (!panels.has(panel)) panels.set(panel, []);

        // Deduplicate
        const existing = panels.get(panel)!;
        if (!existing.find(l => l.name === lab.name)) {
          existing.push(lab);
        }

        // Track platelet history
        if (lab.name.toLowerCase().includes('platelet')) {
          if (!plateletHistory.find(p => p.date === dateStr)) {
            plateletHistory.push({ date: dateStr, value: lab.value });
          }
        }
      }
    }

    // Convert to sorted array
    const sortedDates = Array.from(byDate.keys()).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    const labSets = sortedDates.map((dateStr, i) => {
      const panelMap = byDate.get(dateStr)!;
      const panelOrder = ['CBC with Differential', 'Comprehensive Metabolic Panel', 'Immunology'];
      const sortedPanels = Array.from(panelMap.keys()).sort((a, b) => {
        const ia = panelOrder.indexOf(a);
        const ib = panelOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      return {
        date: dateStr,
        isNew: i === 0,
        panels: sortedPanels.map(name => ({
          name,
          items: panelMap.get(name)!,
        })),
      };
    });

    // Sort platelet history chronologically
    plateletHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { labSets, plateletHistory };
  }

  /**
   * Get all medications from documents
   */
  static async getMedicationHistory(): Promise<ExtractedMedication[]> {
    const docs = await this.getAllDocuments();
    const meds = new Map<string, ExtractedMedication>();

    // Latest document wins for each medication
    for (const doc of docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())) {
      if (doc.medications) {
        for (const med of doc.medications) {
          if (!meds.has(med.name.toLowerCase())) {
            meds.set(med.name.toLowerCase(), med);
          }
        }
      }
    }

    return Array.from(meds.values());
  }

  /**
   * Get all visit notes/summaries for timeline
   */
  static async getVisitTimeline(): Promise<DocumentExtractionResult[]> {
    const docs = await this.getAllDocuments();
    return docs.filter(d =>
      ['visit_notes', 'visit_summary', 'discharge_summary'].includes(d.category)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Get document count by category for dashboard
   */
  static async getDocumentStats(): Promise<Record<DocumentCategory, number>> {
    const docs = await this.getAllDocuments();
    const stats: Record<string, number> = {};
    for (const doc of docs) {
      stats[doc.category] = (stats[doc.category] || 0) + 1;
    }
    return stats as Record<DocumentCategory, number>;
  }

  /**
   * Delete a document by id
   */
  static async deleteDocument(id: string): Promise<void> {
    const docs = await this.getAllDocuments();
    const filtered = docs.filter(d => d.id !== id);
    await AsyncStorage.setItem(DOCS_KEY, JSON.stringify(filtered));
  }

  /**
   * Clear all documents
   */
  static async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([DOCS_KEY, LABS_FROM_DOCS_KEY]);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /**
   * Merge extracted lab values into the lab history cache
   */
  private static async mergeLabsIntoHistory(doc: DocumentExtractionResult): Promise<void> {
    // Lab data will be pulled from documents on demand via getLabHistory()
    // No separate merge needed — it reads from all docs
  }

  /**
   * Determine which panel a lab test belongs to
   */
  private static getPanel(labName: string): string {
    const name = labName.toLowerCase();
    if (['platelet', 'wbc', 'rbc', 'hemoglobin', 'hematocrit', 'mpv', 'neutrophil', 'lymphocyte', 'monocyte', 'eosinophil', 'basophil', 'mch', 'mchc', 'mcv', 'rdw'].some(k => name.includes(k))) {
      return 'CBC with Differential';
    }
    if (['alt', 'ast', 'bilirubin', 'glucose', 'bun', 'creatinine', 'sodium', 'potassium', 'chloride', 'co2', 'calcium', 'albumin', 'protein', 'alkaline', 'gfr'].some(k => name.includes(k))) {
      return 'Comprehensive Metabolic Panel';
    }
    if (['igg', 'iga', 'igm', 'ige', 'complement', 'ana', 'anti', 'antibod'].some(k => name.includes(k))) {
      return 'Immunology';
    }
    if (['pt', 'ptt', 'inr', 'fibrinogen', 'd-dimer', 'bleeding'].some(k => name.includes(k))) {
      return 'Coagulation';
    }
    return 'Other Results';
  }

  /**
   * Get category icon
   */
  static getCategoryIcon(category: DocumentCategory): string {
    const icons: Record<DocumentCategory, string> = {
      lab_results: '🔬',
      visit_notes: '📋',
      visit_summary: '📄',
      discharge_summary: '🏥',
      medication_list: '💊',
      imaging_report: '📷',
      pathology_report: '🔬',
      referral: '📨',
      other: '📎',
    };
    return icons[category] || '📎';
  }

  /**
   * Get category color
   */
  static getCategoryColor(category: DocumentCategory): string {
    const colors: Record<DocumentCategory, string> = {
      lab_results: '#3B82F6',
      visit_notes: '#8B5CF6',
      visit_summary: '#10B981',
      discharge_summary: '#F59E0B',
      medication_list: '#EF4444',
      imaging_report: '#6366F1',
      pathology_report: '#EC4899',
      referral: '#14B8A6',
      other: '#6B7280',
    };
    return colors[category] || '#6B7280';
  }
}
