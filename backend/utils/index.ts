import { TransactionType, TRANSACTION_TYPE_OPTIONS } from "../types";

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
  console.log("Date:::::::::::::", date)
  if(date?.includes('/')){
    const [month, year] = date.split("/");
  
    const fullDate = new Date(2000 + Number(year), Number(month) - 1, 1).valueOf();
  
    return fullDate
  }
  return date ? new Date(date).valueOf() : null;
}
