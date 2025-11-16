import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

interface SubTask {
  id: string;
  label: string;
  completed: boolean;
}

interface WorkflowCardProps {
  title: string;
  subTasks?: SubTask[];
  completed: boolean;
  onToggle: () => void;
  onSubTaskToggle?: (taskId: string) => void;
  icon?: React.ReactNode;
}

export function WorkflowCard({
  title,
  subTasks,
  completed,
  onToggle,
  onSubTaskToggle,
  icon,
}: WorkflowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSubTasks = subTasks && subTasks.length > 0;

  const completedSubTasks = subTasks?.filter((t) => t.completed).length || 0;
  const totalSubTasks = subTasks?.length || 0;
  const progress = totalSubTasks > 0 ? (completedSubTasks / totalSubTasks) * 100 : 0;

  return (
    <Card className={`transition-all ${completed ? "bg-muted/50" : ""}`}>
      <CardHeader
        className="cursor-pointer hover:bg-accent/5 transition-colors"
        onClick={() => hasSubTasks && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {hasSubTasks && (
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
          )}
          
          <div className="flex items-center gap-3 flex-1">
            <Checkbox
              checked={completed}
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              onClick={(e) => e.stopPropagation()}
            />
            
            {icon && <div className="text-primary">{icon}</div>}
            
            <CardTitle className={`text-lg ${completed ? "line-through text-muted-foreground" : ""}`}>
              {title}
            </CardTitle>
          </div>

          {hasSubTasks && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {completedSubTasks}/{totalSubTasks}
              </span>
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      {hasSubTasks && isExpanded && (
        <CardContent className="pt-0 pl-14 space-y-2">
          {subTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 py-2">
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => onSubTaskToggle?.(task.id)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <label
                className={`text-sm cursor-pointer ${
                  task.completed ? "line-through text-muted-foreground" : ""
                }`}
                onClick={() => onSubTaskToggle?.(task.id)}
              >
                {task.label}
              </label>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
