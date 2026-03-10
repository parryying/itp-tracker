/**
 * Azure OpenAI Service
 *
 * Provides AI-powered clinical reasoning for ITP monitoring:
 * - Bruise detection and counting from photos (Vision API)
 * - Lab result interpretation with MD-level reasoning
 * - Doctor discussion question generation
 * - Daily clinical summaries
 *
 * All calls go to YOUR Azure OpenAI instance — no data leaves your subscription.
 */

const CONFIG = {
  endpoint: process.env.EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT || '',
  apiKey: process.env.EXPO_PUBLIC_AZURE_OPENAI_KEY || '',
  deployment: process.env.EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  apiVersion: '2024-10-21',
};

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
}

/**
 * Call Azure OpenAI Chat Completions API
 */
async function callAzureOpenAI(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const url = `${CONFIG.endpoint}/openai/deployments/${CONFIG.deployment}/chat/completions?api-version=${CONFIG.apiVersion}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': CONFIG.apiKey,
    },
    body: JSON.stringify({
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================
// BRUISE DETECTION (Vision)
// ============================================================

const BRUISE_DETECTION_SYSTEM = `You are a medical imaging assistant specializing in dermatological assessment for a pediatric patient with Immune Thrombocytopenia (ITP).

When shown a photo of a body region, you must:
1. Count the number of bruises (ecchymoses) visible
2. Count any petechiae (tiny red/purple spots)
3. Note any blood blisters (oral) if mouth region
4. Estimate the approximate size of each bruise (small <2cm, medium 2-5cm, large >5cm)
5. Note the color stage of each bruise (fresh/red-purple, mid/blue-green, healing/yellow-brown)
6. Rate overall severity: mild, moderate, severe

Respond in this exact JSON format:
{
  "bruise_count": number,
  "petechiae_count": number,
  "blood_blisters": number,
  "bruises": [
    {"size": "small|medium|large", "color_stage": "fresh|mid|healing", "location_description": "string"}
  ],
  "severity": "mild|moderate|severe",
  "summary": "Brief clinical description",
  "comparison_notes": "If previous day photo provided, note changes"
}`;

export interface BruiseAnalysis {
  bruise_count: number;
  petechiae_count: number;
  blood_blisters: number;
  bruises: Array<{
    size: string;
    color_stage: string;
    location_description: string;
  }>;
  severity: string;
  summary: string;
  comparison_notes: string;
}

/**
 * Analyze a photo for bruises, petechiae, and blisters.
 * Optionally compare against a previous day's photo.
 */
export async function analyzeBruisePhoto(
  photoBase64: string,
  bodyRegion: string,
  previousPhotoBase64?: string
): Promise<BruiseAnalysis> {
  const userContent: any[] = [
    {
      type: 'text',
      text: `Analyze this photo of the patient's ${bodyRegion} for bruises, petechiae, and blood blisters.${
        previousPhotoBase64 ? ' The second image is from yesterday — compare and note changes.' : ''
      }`,
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${photoBase64}`,
        detail: 'high',
      },
    },
  ];

  if (previousPhotoBase64) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${previousPhotoBase64}`,
        detail: 'high',
      },
    });
  }

  const response = await callAzureOpenAI([
    { role: 'system', content: BRUISE_DETECTION_SYSTEM },
    { role: 'user', content: userContent },
  ]);

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (e) {
    console.error('Failed to parse bruise analysis:', e);
    return {
      bruise_count: 0,
      petechiae_count: 0,
      blood_blisters: 0,
      bruises: [],
      severity: 'unknown',
      summary: response,
      comparison_notes: '',
    };
  }
}

// ============================================================
// LAB INTERPRETATION
// ============================================================

const LAB_INTERPRETATION_SYSTEM = `You are a pediatric hematologist reviewing lab results for a child with chronic Immune Thrombocytopenia (ITP).

You have access to the patient's complete lab history, current medications with dosage history, and daily symptom logs.

Your job:
1. INTERPRET each abnormal value in clinical context — not just "high" or "low", but WHY it matters for THIS patient with ITP
2. CORRELATE across lab types (CBC + liver function + coagulation + immunology)
3. IDENTIFY trends over time and link them to medication changes
4. FLAG any urgent findings that need immediate attention
5. Provide an overall clinical assessment

Be specific. Reference actual values, dates, and medication changes. Think step by step like an attending hematologist reviewing a case.

Respond in this JSON format:
{
  "interpretation": "Detailed clinical interpretation (2-3 paragraphs)",
  "flags": [
    {"lab": "name", "value": "value with unit", "severity": "critical|warning|info", "explanation": "why this matters"}
  ],
  "correlations": ["Cross-lab correlation observations"],
  "trends": ["Notable trends with timeframes"],
  "urgent": boolean,
  "urgent_message": "string or null"
}`;

export interface LabInterpretation {
  interpretation: string;
  flags: Array<{
    lab: string;
    value: string;
    severity: string;
    explanation: string;
  }>;
  correlations: string[];
  trends: string[];
  urgent: boolean;
  urgent_message: string | null;
}

/**
 * Interpret lab results with full clinical context.
 */
export async function interpretLabResults(
  labResults: any[],
  medications: any[],
  symptoms: any[]
): Promise<LabInterpretation> {
  const userPrompt = `Here are the patient's recent lab results, medications, and symptoms. Provide your clinical interpretation.

**Lab Results (most recent first):**
${JSON.stringify(labResults, null, 2)}

**Current Medications:**
${JSON.stringify(medications, null, 2)}

**Recent Symptoms:**
${JSON.stringify(symptoms, null, 2)}`;

  const response = await callAzureOpenAI([
    { role: 'system', content: LAB_INTERPRETATION_SYSTEM },
    { role: 'user', content: userPrompt },
  ]);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found');
  } catch (e) {
    console.error('Failed to parse lab interpretation:', e);
    return {
      interpretation: response,
      flags: [],
      correlations: [],
      trends: [],
      urgent: false,
      urgent_message: null,
    };
  }
}

// ============================================================
// DOCTOR DISCUSSION QUESTIONS
// ============================================================

const DOCTOR_QUESTIONS_SYSTEM = `You are a pediatric hematologist helping a parent prepare for their child's ITP clinic visit.

Based on the patient's recent labs, medication history, symptom trends, and photo assessments, generate 3-7 specific, actionable questions the parent should ask the treating physician.

Each question must be:
- Grounded in actual data (reference specific values, dates, trends)
- Clinically relevant and specific to THIS patient's situation
- Phrased as a question the parent can directly ask
- Accompanied by a brief context explaining WHY this question matters

Respond in this JSON format:
{
  "questions": [
    {
      "category": "Steroid Taper|Medication|Bleeding Risk|Labs|Treatment Plan|Immunology|Side Effects",
      "question": "The actual question to ask",
      "context": "Why this question is important, with supporting data",
      "priority": "high|medium|low"
    }
  ],
  "overall_assessment": "2-3 sentence summary of the patient's current status"
}`;

export interface DoctorQuestions {
  questions: Array<{
    category: string;
    question: string;
    context: string;
    priority: string;
  }>;
  overall_assessment: string;
}

/**
 * Generate doctor discussion questions based on all patient data.
 */
export async function generateDoctorQuestions(
  labResults: any[],
  medications: any[],
  symptoms: any[],
  bruiseAssessments: any[]
): Promise<DoctorQuestions> {
  const userPrompt = `Generate doctor discussion questions based on this patient data:

**Recent Lab Results:**
${JSON.stringify(labResults, null, 2)}

**Medications & Dosage History:**
${JSON.stringify(medications, null, 2)}

**Recent Symptoms & Daily Logs:**
${JSON.stringify(symptoms, null, 2)}

**Bruise/Photo Assessments:**
${JSON.stringify(bruiseAssessments, null, 2)}`;

  const response = await callAzureOpenAI(
    [
      { role: 'system', content: DOCTOR_QUESTIONS_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: 3000 }
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found');
  } catch (e) {
    console.error('Failed to parse doctor questions:', e);
    return {
      questions: [],
      overall_assessment: response,
    };
  }
}

// ============================================================
// DAILY CLINICAL SUMMARY
// ============================================================

const DAILY_SUMMARY_SYSTEM = `You are a pediatric hematologist writing a daily clinical note for a child with chronic ITP.

Write a comprehensive but parent-friendly summary covering:
1. **Hematology**: Platelet count, trends, bone marrow response (MPV)
2. **Hepatology**: Liver function if relevant (medication side effects)
3. **Immunology**: Immune status if relevant
4. **Physical Assessment**: Bruise/bleeding summary from photos
5. **Medication Status**: Current regimen, recent changes, side effects
6. **Overall Assessment**: Clinical trajectory and key concerns

Write in a clear, professional tone that a medical-literate parent can understand.
Include specific numbers, dates, and medication names.
End with: "This is an AI-generated summary for informational purposes. It does not replace medical advice."`;

/**
 * Generate a comprehensive daily clinical summary.
 */
export async function generateDailySummary(
  labResults: any[],
  medications: any[],
  symptoms: any[],
  bruiseAssessments: any[],
  date: string
): Promise<string> {
  const userPrompt = `Generate a daily clinical summary for ${date}:

**Lab Results:**
${JSON.stringify(labResults, null, 2)}

**Medications:**
${JSON.stringify(medications, null, 2)}

**Symptoms & Daily Log:**
${JSON.stringify(symptoms, null, 2)}

**Photo Assessments:**
${JSON.stringify(bruiseAssessments, null, 2)}`;

  return callAzureOpenAI(
    [
      { role: 'system', content: DAILY_SUMMARY_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: 2500 }
  );
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  analyzeBruisePhoto,
  interpretLabResults,
  generateDoctorQuestions,
  generateDailySummary,
};
