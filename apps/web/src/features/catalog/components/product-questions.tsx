"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAskQuestion, useProductQuestions } from "@/features/catalog/api";
import { useIsAuthenticated } from "@/features/auth/store";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { questionSchema, type QuestionFormValues } from "@/lib/validation/schemas";

export function ProductQuestions({ productId, productSlug }: { productId: string; productSlug: string }) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const format = useFormatter();
  const isAuthenticated = useIsAuthenticated();
  const questions = useProductQuestions(productId);
  const ask = useAskQuestion(productId);
  const items = questions.data?.pages.flatMap((p) => p.items) ?? [];

  const form = useForm<QuestionFormValues>({ resolver: zodResolver(questionSchema), defaultValues: { question: "" } });
  const errorKey = form.formState.errors.question?.message;

  const onSubmit = form.handleSubmit((values) => {
    ask.mutate({ productId, question: values.question }, {
      onSuccess: () => {
        form.reset();
        toast.success(t("questionSent"));
      },
      onError: (error) => {
        const msg = isApiError(error) ? error.errors?.question?.[0] ?? error.message : tc("loading");
        toast.error(msg);
      },
    });
  });

  return (
    <section aria-labelledby="questions-title" className="flex flex-col gap-4">
      <h2 id="questions-title" className="text-lg font-bold">
        {t("questionsTitle")}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
          <label htmlFor="question" className="text-sm font-medium">
            {t("askQuestion")}
          </label>
          <Textarea
            id="question"
            rows={3}
            placeholder={t("questionPlaceholder")}
            aria-invalid={errorKey ? true : undefined}
            aria-describedby={errorKey ? "question-error" : undefined}
            {...form.register("question")}
          />
          {errorKey ? (
            <p id="question-error" className="text-xs text-destructive">
              {tv(errorKey as "questionMin" | "questionMax")}
            </p>
          ) : null}
          <Button type="submit" className="self-end" disabled={ask.isPending}>
            {ask.isPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {t("sendQuestion")}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground">{t("askQuestion")}</p>
          <Button variant="outline" render={<Link href={`/entrar?next=/produto/${productSlug}`} />}>
            {t("loginToAsk")}
          </Button>
        </div>
      )}

      {questions.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : questions.isError ? (
        <ErrorState error={questions.error} compact onRetry={() => questions.refetch()} />
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircleQuestion className="size-4" aria-hidden /> {t("noQuestions")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((q) => (
            <li key={q.id} className="py-4 first:pt-0">
              <p className="text-sm font-medium">{q.question}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {q.askedBy} · {format.dateTime(new Date(q.askedAt), "short")}
              </p>
              {q.answer ? (
                <div className="mt-2 rounded-lg bg-surface p-3">
                  <p className="text-xs font-semibold text-primary">{t("sellerAnswer")}</p>
                  <p className="mt-0.5 text-sm">{q.answer.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{format.dateTime(new Date(q.answer.answeredAt), "short")}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-warning">{t("awaitingAnswer")}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {questions.hasNextPage ? (
        <Button variant="outline" onClick={() => questions.fetchNextPage()} disabled={questions.isFetchingNextPage} className="self-center">
          {tc("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
