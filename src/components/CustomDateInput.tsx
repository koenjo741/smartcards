import React from 'react';
import { normalizeDateInput } from '../utils/dateUtils';

interface CustomDateInputProps {
    value?: string;
    onClick?: () => void;
    onChange?: (e: any) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
}

export const CustomDateInput = React.forwardRef<HTMLInputElement, CustomDateInputProps>((props, ref) => {
    const { value, onClick, onChange, onBlur: parentOnBlur, placeholder, className, required, disabled } = props;
    const [localValue, setLocalValue] = React.useState(value || '');

    React.useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const input = e.target;
        const rawValue = input.value;
        const normalized = normalizeDateInput(rawValue);

        if (rawValue !== normalized) {
            setLocalValue(normalized);
            // Trigger onChange so DatePicker parses the normalized value
            if (onChange) {
                const event = {
                    target: { ...input, value: normalized },
                    currentTarget: { ...input, value: normalized },
                    type: 'change',
                    persist: () => {},
                    preventDefault: () => {},
                    stopPropagation: () => {}
                } as any;
                onChange(event);
            }
        } else if (rawValue !== value) {
            // Even if not normalized, if it changed from the prop value, we should update the parent
            if (onChange) {
                const event = {
                    target: input,
                    currentTarget: input,
                    type: 'change',
                    persist: () => {},
                    preventDefault: () => {},
                    stopPropagation: () => {}
                } as any;
                onChange(event);
            }
        }
        
        if (parentOnBlur) {
            parentOnBlur(e);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <input
            ref={ref}
            value={localValue}
            onClick={onClick}
            onChange={handleLocalChange}
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
