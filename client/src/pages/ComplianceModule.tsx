import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  format,
  addDays,
  isBefore,
  isAfter,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Plus,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ComplianceDocument {
  id: number;
  clientId: number;
  clientName: string;
  documentType: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string;
  status: "active" | "expiring" | "expired" | "renewed";
  fileUrl: string | null;
  fileName: string | null;
  daysUntilExpiry: number;
}

interface DashboardStats {
  totalDocuments: number;
  activeDocuments: number;
  expiringSoon: number;
  expiredDocuments: number;
  renewedThisMonth: number;
}

const documentTypeLabels: Record<string, string> = {
  cr: "Certificado de Registro (CR)",
  gt: "Guia de Tráfego (GT)",
  craf: "CRAF",
  laudo: "Laudo Técnico",
  certificado: "Certificado",
  other: "Outros",
};

const statusConfig = {
  active: { color: "bg-green-500", label: "Válido", icon: CheckCircle2 },
  expiring: { color: "bg-yellow-500", label: "Vencendo", icon: Clock },
  expired: { color: "bg-red-500", label: "Vencido", icon: AlertTriangle },
  renewed: { color: "bg-blue-500", label: "Renovado", icon: CheckCircle2 },
};

export function ComplianceModule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedDocumentType, setSelectedDocumentType] = useState<
    string | null
  >(null);

  const { data: stats } = useQuery({
    queryKey: ["compliance", "stats"],
    queryFn: async () => {
      const result = await trpc.compliance.getDashboardStats.query();
      return result as DashboardStats;
    },
  });

  const { data: expiringSoon } = useQuery({
    queryKey: ["compliance", "expiring", 30],
    queryFn: async () => {
      const result = await trpc.compliance.getExpiringSoon.query({
        daysThreshold: 30,
      });
      return result as ComplianceDocument[];
    },
  });

  const { data: documents } = useQuery({
    queryKey: ["compliance", "documents", selectedDocumentType],
    queryFn: async () => {
      const result = await trpc.compliance.getDocuments.query({
        documentType: selectedDocumentType || undefined,
      });
      return result as ComplianceDocument[];
    },
  });

  // Calendar data - documents expiring on each day
  const getDocumentsForDate = (date: Date): ComplianceDocument[] => {
    if (!expiringSoon) return [];
    return expiringSoon.filter(doc => {
      const expiryDate = new Date(doc.expiryDate);
      return (
        expiryDate.getDate() === date.getDate() &&
        expiryDate.getMonth() === date.getMonth() &&
        expiryDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Get all days in current month view
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get documents for selected date
  const selectedDateDocuments = getDocumentsForDate(selectedDate);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Compliance & Vencimentos
          </h1>
          <p className="text-slate-600 mt-1">
            Gerenciamento de documentos e acompanhamento de validades
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Documento
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total de Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {stats?.totalDocuments || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Documentos Válidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats?.activeDocuments || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Vencendo em 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {stats?.expiringSoon || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Documentos Vencidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {stats?.expiredDocuments || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Calendário
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    Calendário de Vencimentos
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(subDays(selectedDate, 30))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[120px] text-center">
                      {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(addDays(selectedDate, 30))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                    day => (
                      <div
                        key={day}
                        className="text-center text-sm font-medium text-slate-500 py-2"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {daysInMonth.map((date, index) => {
                    const dayDocs = getDocumentsForDate(date);
                    const hasExpiring = dayDocs.some(
                      d => d.status === "expiring"
                    );
                    const hasExpired = dayDocs.some(
                      d => d.status === "expired"
                    );
                    const isSelected =
                      selectedDate.getDate() === date.getDate() &&
                      selectedDate.getMonth() === date.getMonth();

                    return (
                      <button
                        key={date.toISOString()}
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          "aspect-square p-2 rounded-lg border text-sm font-medium transition-colors relative",
                          isSelected
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white hover:bg-slate-50 border-slate-200",
                          hasExpired &&
                            !isSelected &&
                            "border-red-300 bg-red-50",
                          hasExpiring &&
                            !isSelected &&
                            !hasExpired &&
                            "border-yellow-300 bg-yellow-50"
                        )}
                      >
                        {format(date, "d")}
                        {dayDocs.length > 0 && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                            {hasExpired && (
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            )}
                            {hasExpiring && !hasExpired && (
                              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-slate-600">Vencido</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm text-slate-600">
                      Vencendo em 30 dias
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-slate-600">Válido</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documents for Selected Date */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedDateDocuments.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    Nenhum documento com vencimento nesta data
                  </p>
                ) : (
                  selectedDateDocuments.map(doc => {
                    const StatusIcon = statusConfig[doc.status].icon;
                    return (
                      <div
                        key={doc.id}
                        className="p-3 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <StatusIcon
                              className={cn(
                                "w-4 h-4",
                                doc.status === "expired"
                                  ? "text-red-500"
                                  : doc.status === "expiring"
                                    ? "text-yellow-500"
                                    : "text-green-500"
                              )}
                            />
                            <div>
                              <p className="font-medium text-sm">
                                {documentTypeLabels[doc.documentType] ||
                                  doc.documentType}
                              </p>
                              <p className="text-xs text-slate-500">
                                {doc.clientName}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              doc.status === "expired" &&
                                "border-red-300 text-red-600",
                              doc.status === "expiring" &&
                                "border-yellow-300 text-yellow-600",
                              doc.status === "active" &&
                                "border-green-300 text-green-600"
                            )}
                          >
                            {statusConfig[doc.status].label}
                          </Badge>
                        </div>
                        {doc.documentNumber && (
                          <p className="text-xs text-slate-500 mt-2">
                            Nº: {doc.documentNumber}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Lista de Documentos
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar documentos..."
                      className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documents?.map(doc => {
                  const StatusIcon = statusConfig[doc.status].icon;
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            doc.status === "expired" && "bg-red-100",
                            doc.status === "expiring" && "bg-yellow-100",
                            doc.status === "active" && "bg-green-100",
                            doc.status === "renewed" && "bg-blue-100"
                          )}
                        >
                          <FileText
                            className={cn(
                              "w-5 h-5",
                              doc.status === "expired" && "text-red-600",
                              doc.status === "expiring" && "text-yellow-600",
                              doc.status === "active" && "text-green-600",
                              doc.status === "renewed" && "text-blue-600"
                            )}
                          />
                        </div>
                        <div>
                          <p className="font-medium">
                            {documentTypeLabels[doc.documentType] ||
                              doc.documentType}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>{doc.clientName}</span>
                            {doc.documentNumber && (
                              <>
                                <span>•</span>
                                <span>Nº {doc.documentNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            Vencimento:{" "}
                            {format(new Date(doc.expiryDate), "dd/MM/yyyy")}
                          </p>
                          <p
                            className={cn(
                              "text-xs",
                              doc.daysUntilExpiry < 0
                                ? "text-red-600"
                                : doc.daysUntilExpiry <= 30
                                  ? "text-yellow-600"
                                  : "text-slate-500"
                            )}
                          >
                            {doc.daysUntilExpiry < 0
                              ? `Vencido há ${Math.abs(doc.daysUntilExpiry)} dias`
                              : doc.daysUntilExpiry === 0
                                ? "Vence hoje"
                                : `Vence em ${doc.daysUntilExpiry} dias`}
                          </p>
                        </div>
                        <Badge
                          className={cn(
                            doc.status === "expired" &&
                              "bg-red-100 text-red-700 hover:bg-red-100",
                            doc.status === "expiring" &&
                              "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
                            doc.status === "active" &&
                              "bg-green-100 text-green-700 hover:bg-green-100",
                            doc.status === "renewed" &&
                              "bg-blue-100 text-blue-700 hover:bg-blue-100"
                          )}
                        >
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[doc.status].label}
                        </Badge>
                        {doc.fileUrl && (
                          <Button variant="ghost" size="sm">
                            <Upload className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ComplianceModule;
