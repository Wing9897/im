import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  createItem,
  getItem,
  listItemCategories,
  updateItem,
  type TrackableItem,
} from "../../api/items";
import { listWorksets } from "../../api/worksets";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { contentFadeClass, formPageMaxWidthClass } from "../../components/ui/pageLayout";
import { categoryLabel } from "../../domain/items/categoryAggregates";
import { partitionItemAttributes } from "../../domain/items/itemAttributes";
import { formatItemsError } from "../../domain/items/itemErrors";
import type { Workset } from "../../types/worksets";
import { scheduleEmojiPickerPreload } from "./emojiPickerLoader";
import { ItemForm, type ItemFormHandle, type ItemSaveDraft } from "./ItemForm";
import { ItemFormToolbar } from "./ItemFormToolbar";
import { itemFormPageFillClass } from "./itemsPageChromeClasses";
import {
  resolveCreateInitialCategoryId,
  resolveItemFormBackPath,
} from "./itemsNavigation";

export function ItemFormPage() {
  const { t } = useTranslation("items");
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId?: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(itemId);
  const formRef = useRef<ItemFormHandle>(null);

  const [item, setItem] = useState<TrackableItem | null>(null);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof listItemCategories>>>([]);
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toolbarState, setToolbarState] = useState({ canSubmit: false, busy: false });

  const categoryIdParam = searchParams.get("categoryId")?.trim() || null;
  const initialCategoryId = resolveCreateInitialCategoryId(categoryIdParam);
  const initialWorksetId = searchParams.get("worksetId")?.trim() || null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const [categoryRows, worksetRows] = await Promise.all([
          listItemCategories(),
          listWorksets(),
        ]);
        if (cancelled) return;
        setCategories(categoryRows);
        setWorksets(worksetRows);
        if (isEditMode && itemId) {
          const row = await getItem(itemId);
          if (cancelled) return;
          setItem(row);
        } else {
          setItem(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(formatItemsError(err, t));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, itemId, t]);

  // Form always has an emoji field — warm the picker chunk while data loads.
  useEffect(() => scheduleEmojiPickerPreload(2000), []);

  const backPath = resolveItemFormBackPath({
    categoryIdParam,
    itemCategoryId: item?.categoryId ?? null,
    itemKnown: isEditMode && Boolean(item),
  });

  const handleBack = useCallback(() => {
    if (formRef.current?.busy) return;
    navigate(backPath);
  }, [backPath, navigate]);

  const handleSave = useCallback(
    async (draft: ItemSaveDraft) => {
      if (draft.id) {
        await updateItem(draft.id, draft);
      } else {
        await createItem(draft);
      }
      navigate(backPath);
    },
    [backPath, navigate],
  );

  const triggerSave = () => {
    void formRef.current?.submit();
  };

  const formBusy = toolbarState.busy;
  const canSave = toolbarState.canSubmit;

  return (
    <div className={itemFormPageFillClass} data-testid="item-form-page">
      <ItemFormToolbar
        isEditMode={isEditMode}
        canSave={canSave}
        busy={formBusy}
        onBack={handleBack}
        onSave={triggerSave}
      />

      <div className="im-auto-scrollbar min-h-0 overflow-y-auto">
        <div className={`mx-auto w-full min-w-0 px-page-x pb-md pt-sm ${formPageMaxWidthClass}`}>
          {loadError ? (
            <p className="mb-sm text-caption text-error" role="alert">
              {loadError}
            </p>
          ) : null}
          {loading ? (
            <div className="min-h-[18rem]" aria-busy="true">
              <SkeletonScreen variant="list-rows" count={7} />
            </div>
          ) : (
            <div
              className={`im-animate-in ${contentFadeClass}`}
              data-allow-opacity-transition
            >
              <ItemForm
                ref={formRef}
                item={item}
                categories={categories}
                worksets={worksets}
                categoryLabel={categoryLabel}
                initialCategoryId={initialCategoryId}
                initialWorksetId={initialWorksetId}
                onSave={handleSave}
                onToolbarStateChange={setToolbarState}
                partitionItemAttributes={partitionItemAttributes}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
