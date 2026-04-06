import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, MessageSquareMore, Flame, Target, Home, Goal } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = [
  { id: "home", label: "Home", icon: Home },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "hot", label: "Hot", icon: Flame },
  { id: "campaigns", label: "Campaigns", icon: Goal },
];

const FilterBar = ({ selectedFilter, onFilterChange }: FilterBarProps) => {
  return (
    <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isSelected = selectedFilter === filter.id;
        
        return (
          <Button
            key={filter.id}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "rounded-full transition-smooth whitespace-nowrap h-8 md:h-9 px-2.5 md:px-3 text-xs md:text-sm",
              isSelected 
                ? "gradient-primary shadow-glow text-white hover:shadow-large" 
                : "hover:bg-muted border-border/50"
            )}
          >
            <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1 md:mr-2" />
            {filter.label}
          </Button>
        );
      })}
    </div>
  );
};

export default FilterBar;