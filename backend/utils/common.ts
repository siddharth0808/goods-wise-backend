import { TransactionType, TRANSACTION_TYPE_OPTIONS } from "../types/transactions";

export function getTransactionSign(type: TransactionType): 1 | -1 {
  const match = TRANSACTION_TYPE_OPTIONS.find((option) => option.value === type);
  return (match?.sign ?? 1) as 1 | -1;
}

export function getExtension(fileName: string, contentType: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension) {
    return extension;
  }

  switch (contentType) {
    case "application/pdf":
      return "pdf";

    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    default:
      return "bin";
  }
}

export function formatExpiryDate(date: string) {
  if(date?.includes('/')){
    const [month, year] = date.split("/");
  
    const fullDate = new Date(2000 + Number(year), Number(month) - 1, 1);
  
    return fullDate
  }
  return date ? new Date(date) :'';
}

export function formatSaleNumber(
  financialYear: string,
  sequence: number,
): string {
  return `SALE-${financialYear}-${String(sequence).padStart(5, "0")}`;
}

export function getFinancialYear(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 4) {
    return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
  }

  return `${String(year - 1).slice(-2)}-${String(year).slice(-2)}`;
}
