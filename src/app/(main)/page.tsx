import { redirect } from "next/navigation";

/**
 * 根路径重定向到 /home
 */
export default function RootPage() {
  redirect("/home");
}
