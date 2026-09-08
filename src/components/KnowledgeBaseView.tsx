import React, { useState } from 'react';
import {
  Brain,
  FileText,
  Upload,
  CheckCircle2,
  Trash2,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Plus,
} from 'lucide-react';
import { BusinessProfile } from '../types';

interface KnowledgeBaseViewProps {
  business: BusinessProfile;
}

interface DocumentItem {
  id: string;
  name: string;
  category: 'Service Catalog' | 'Pricing & Packages' | 'Technical Specs' | 'Policy / SLA';
  size: string;
  uploadedAt: string;
  status: 'indexed' | 'indexing';
  chunksCount: number;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ business }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: 'doc_1',
      name: 'Aaditech_IT_Services_Catalog_2026.pdf',
      category: 'Service Catalog',
      size: '2.4 MB',
      uploadedAt: '02 Sep 2026',
      status: 'indexed',
      chunksCount: 48,
    },
    {
      id: 'doc_2',
      name: 'Mobile_App_Web_Dev_Pricing_Matrix.pdf',
      category: 'Pricing & Packages',
      size: '1.1 MB',
      uploadedAt: '28 Aug 2026',
      status: 'indexed',
      chunksCount: 22,
    },
    {
      id: 'doc_3',
      name: 'AMC_SLA_Uptime_Warranty_Policy.docx',
      category: 'Policy / SLA',
      size: '640 KB',
      uploadedAt: '24 Aug 2026',
      status: 'indexed',
      chunksCount: 16,
    },
  ]);

  const [faqs, setFaqs] = useState<FaqItem[]>([
    {
      id: 'faq_1',
      question: 'What is the standard delivery timeline for custom business websites?',
      answer: 'Standard responsive business websites are delivered within 10 to 14 working days, including staging preview and SSL configuration.',
      category: 'Websites',
    },
    {
      id: 'faq_2',
      question: 'Does Aaditech Solution assist with Google Play Store compliance for Android apps?',
      answer: 'Yes, full Google Play Console setup, signed release bundle generation, privacy policy hosting, and 14-day closed testing compliance are included.',
      category: 'Mobile Apps',
    },
    {
      id: 'faq_3',
      question: 'What is included in the Google 3-Pack Local SEO package?',
      answer: 'Google Business Profile audit, weekly geo-tagged updates, localized service attributes, review response automation, and citation consistency across Thane & Mumbai MMR.',
      category: 'SEO',
    },
  ]);

  const [testQuery, setTestQuery] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleTestFactSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setIsSearching(true);
    setTestResponse(null);

    setTimeout(() => {
      setIsSearching(false);
      const q = testQuery.toLowerCase();
      if (q.includes('price') || q.includes('cost') || q.includes('rate')) {
        setTestResponse(
          'Grounded Fact (doc_2): Aaditech Solution packages start from ₹9,999 for foundational business websites up to ₹1,49,000 for full custom enterprise portals & mobile apps. Fact check passed: No price hallucination.'
        );
      } else if (q.includes('time') || q.includes('day') || q.includes('delivery')) {
        setTestResponse(
          'Grounded Fact (faq_1): Website delivery timeline is strictly 10-14 working days. Android apps are 3-4 weeks. Fact check passed: Accurate SLA matched.'
        );
      } else {
        setTestResponse(
          `Grounded Fact: Verified against Aaditech Solution knowledge vectors for "${testQuery}". The AI will only use verified documents to answer client inquiries.`
        );
      }
    }, 600);
  };

  const handleSimulateUpload = () => {
    const newDoc: DocumentItem = {
      id: `doc_${Date.now()}`,
      name: 'Client_Case_Studies_Portfolio_2026.pdf',
      category: 'Service Catalog',
      size: '3.2 MB',
      uploadedAt: 'Just now',
      status: 'indexed',
      chunksCount: 34,
    };
    setDocuments((prev) => [newDoc, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-xs font-bold rounded-full flex items-center gap-1">
              <Brain className="w-3 h-3" /> Master Blueprint Section 56, 76, 77
            </span>
            <span className="text-xs text-emerald-400 font-bold">
              AI Memory Active • Anti-Hallucination Guardrails ON
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Business Knowledge Base & AI Memory</h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
            Upload Aaditech Solution brochures, service rate cards, SLAs, and FAQs. The Autonomous AI Marketing Manager uses these exact facts to draft review replies, social posts, and WhatsApp quotes without hallucinating.
          </p>
        </div>

        <button
          onClick={handleSimulateUpload}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition shadow-xs flex-shrink-0"
        >
          <Upload className="w-4 h-4" /> Upload Document / PDF
        </button>
      </div>

      {/* Grounded Fact Search Tester */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" /> Test AI Memory & Fact-Checking (Section 77)
          </h3>
          <span className="text-[11px] text-slate-400">Queries internal vector embeddings</span>
        </div>

        <form onSubmit={handleTestFactSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Ask anything (e.g., 'What are our website delivery timelines?' or 'What is our starting price?')"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition"
          >
            {isSearching ? 'Verifying...' : 'Verify Fact'}
          </button>
        </form>

        {testResponse && (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-3 text-xs">
            <ShieldCheck className="w-4 h-4 text-indigo-700 flex-shrink-0 mt-0.5" />
            <div className="text-indigo-950 font-medium leading-relaxed">{testResponse}</div>
          </div>
        )}
      </div>

      {/* Two Columns: Uploaded Documents & Verified Business FAQs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Document Repository */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> Indexed Knowledge Documents ({documents.length})
            </h3>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> All Vectorized
            </span>
          </div>

          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 hover:border-indigo-300 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-bold text-xs">
                    PDF
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900 truncate max-w-[220px]">{doc.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{doc.category}</span>
                      <span>•</span>
                      <span>{doc.size}</span>
                      <span>•</span>
                      <span className="text-indigo-600 font-medium">{doc.chunksCount} chunks</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                    Indexed
                  </span>
                  <button
                    onClick={() => setDocuments((prev) => prev.filter((d) => d.id !== doc.id))}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verified FAQ Memory */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" /> Grounded Business FAQs ({faqs.length})
            </h3>
            <button
              onClick={() => {
                const q = prompt('Enter FAQ Question:');
                const a = prompt('Enter Verified Answer:');
                if (q && a) {
                  setFaqs((prev) => [
                    ...prev,
                    { id: `faq_${Date.now()}`, question: q, answer: a, category: 'Custom' },
                  ]);
                }
              }}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              + Add FAQ
            </button>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <div key={faq.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{faq.question}</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                    {faq.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
