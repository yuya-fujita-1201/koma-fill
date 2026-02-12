import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Panel } from '../types';

interface PanelGridProps {
  panels: Panel[];
  onRegenerate: (panelIndex: number) => void;
  onReorder: (newOrder: number[]) => void;
  onDelete: (panelIndex: number) => void;
}

function toDisplayImage(panel: Panel): string | undefined {
  if (panel.imageUrl) {
    return panel.imageUrl;
  }

  if (!panel.imageFilePath) {
    return undefined;
  }

  const uploadsIndex = panel.imageFilePath.lastIndexOf('/uploads/');
  if (uploadsIndex >= 0) {
    return panel.imageFilePath.slice(uploadsIndex);
  }

  const marker = '/uploads';
  const markerIndex = panel.imageFilePath.lastIndexOf(marker);
  if (markerIndex >= 0) {
    return panel.imageFilePath.slice(markerIndex);
  }

  return undefined;
}

function SortablePanelCard({
  panel,
  onRegenerate,
  onDelete,
}: {
  panel: Panel;
  onRegenerate: (panelIndex: number) => void;
  onDelete: (panelIndex: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: panel.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const imageSrc = toDisplayImage(panel);

  return (
    <div ref={setNodeRef} style={style} className="relative border rounded-lg overflow-hidden bg-white shadow-sm">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {imageSrc ? (
          <img src={imageSrc} alt={`Panel ${panel.panelIndex + 1}`} className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400">
            {panel.status === 'pending' && '待機中'}
            {panel.status === 'failed' && '生成失敗'}
            {panel.status === 'placeholder' && 'プレースホルダー'}
          </div>
        )}
      </div>

      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
        #{panel.panelIndex + 1}
      </div>

      <div className="p-2 space-y-2">
        <p className="text-xs text-gray-500 min-h-8 line-clamp-2">{panel.storyBeat || 'story beat not set'}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onRegenerate(panel.panelIndex)}
            className="flex-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            再生成
          </button>
          <button
            type="button"
            onClick={() => onDelete(panel.panelIndex)}
            className="flex-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PanelGrid({ panels, onRegenerate, onReorder, onDelete }: PanelGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedPanels = [...panels].sort((a, b) => a.panelIndex - b.panelIndex);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedPanels.findIndex((panel) => panel.id === active.id);
    const newIndex = orderedPanels.findIndex((panel) => panel.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const moved = arrayMove(orderedPanels, oldIndex, newIndex);
    onReorder(moved.map((panel) => panel.panelIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedPanels.map((panel) => panel.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {orderedPanels.map((panel) => (
            <SortablePanelCard
              key={panel.id}
              panel={panel}
              onRegenerate={onRegenerate}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
