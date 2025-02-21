import { ComponentType } from 'react';
import { cn } from '@/lib/utils';

type StyleObject = {
  [key: string]: string | number | StyleObject;
};

type StyleConfig = {
  base?: StyleObject;
  variants?: {
    [key: string]: StyleObject;
  };
};

export function styled<P extends object>(
  Component: ComponentType<P>,
  config: StyleConfig
) {
  return function StyledComponent({ className, ...props }: P & { className?: string }) {
    const baseStyles = convertStyleObjectToClassName(config.base || {});
    
    return (
      <Component
        {...(props as P)}
        className={cn(baseStyles, className)}
        style={{
          ...(props as any).style,
          ...convertStyleObjectToInlineStyles(config.base || {}),
        }}
      />
    );
  };
}

function convertStyleObjectToClassName(styleObj: StyleObject): string {
  const classes: string[] = [];
  
  Object.entries(styleObj).forEach(([key, value]) => {
    if (typeof value === 'object') {
      if (key.startsWith('_')) {
        // Handle pseudo-classes and states
        const pseudoClass = key.slice(1);
        Object.entries(value).forEach(([propKey, propValue]) => {
          if (typeof propValue === 'string' || typeof propValue === 'number') {
            classes.push(`${pseudoClass}:${propKey}-[${propValue}]`);
          }
        });
      }
    }
  });
  
  return classes.join(' ');
}

function convertStyleObjectToInlineStyles(styleObj: StyleObject): React.CSSProperties {
  const styles: { [key: string]: string | number } = {};
  
  Object.entries(styleObj).forEach(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      // Convert camelCase to kebab-case
      const kebabKey = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      styles[kebabKey] = value;
    }
  });
  
  return styles as React.CSSProperties;
}
