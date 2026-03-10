import React from 'react';
import { parseUserDateInput, formatDisplayDate } from '../utils/dateUtils';

interface CustomDateInputProps {
    value?: string;
    onClick?: () => void;
    onChange?: (e: any) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onCommit?: () => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
}

export const CustomDateInput = React.forwardRef<HTMLInputElement, CustomDateInputProps>((props, ref) => {
    const { 
        value, 
        onClick, 
        onChange, 
        onBlur: parentOnBlur, 
        onCommit, 
        placeholder, 
        className, 
        required, 
        disabled 
    } = props;
    
    // localValue is always in DD.MM.YYYY format (display format)
    const [localValue, setLocalValue] = React.useState(value || '');
    const isFocused = React.useRef(false);

    React.useEffect(() => {
        // Only update localValue from props if the input is NOT focused
        // This prevents the DatePicker from wiping the user's typing
        if (!isFocused.current) {
            setLocalValue(value || '');
        }
    }, [value]);

    const handleFocus = () => {
        isFocused.current = true;
    };

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        isFocused.current = false;
        const rawValue = e.target.value.trim();
        
        if (!rawValue) {
            if (onChange) onChange(e);
            if (parentOnBlur) parentOnBlur(e);
            return;
        }

        const parsedDate = parseUserDateInput(rawValue);

        if (!parsedDate) {
            alert(`Ungültiges Datum: "${rawValue}" konnte nicht erkannt werden.`);
            setLocalValue(value || ''); // Revert to previous valid value from props
            if (parentOnBlur) parentOnBlur(e);
            return;
        }

        const normalized = formatDisplayDate(parsedDate);
        setLocalValue(normalized);

        // Trigger change if the value actually changed or was normalized
        if (normalized !== value) {
            if (onChange) {
                // Synthetic event for react-datepicker compatibility
                const syntheticEvent = {
                    ...e,
                    target: { ...e.target, value: normalized },
                    currentTarget: { ...e.currentTarget, value: normalized }
                } as any;
                onChange(syntheticEvent);
            }
        }

        if (parentOnBlur) {
            parentOnBlur(e);
        }

        if (onCommit) {
            // Use a 200ms timeout to ensure React state and parent refs have fully synchronized
            // before triggering the save (commit). This fixes race conditions on manual entry.
            setTimeout(() => {
                onCommit();
            }, 200);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.blur();
        }
    };

    return (
        <input
            ref={ref}
            value={localValue}
            onClick={onClick}
            onChange={handleLocalChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={className}
            required={required}
            disabled={disabled}
            type="text"
        />
    );
});
