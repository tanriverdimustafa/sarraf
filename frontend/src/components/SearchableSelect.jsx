import React from 'react';
import Select from 'react-select';

/**
 * Aranabilir Dropdown Komponenti
 * Uzun listeler (müşteri, tedarikçi, ürün, personel vb.) için kullanılır
 */
const SearchableSelect = ({
  options = [],        // [{ value: 'id', label: 'Ad' }]
  value,               // Seçili değer (string id)
  onChange,            // Değişiklik handler (value döndürür)
  placeholder = 'Seçin...',
  isDisabled = false,
  isClearable = true,
  isLoading = false,
  noOptionsMessage = 'Sonuç bulunamadı',
  className = '',
  menuPlacement = 'auto',
  isMulti = false,
}) => {
  // Değeri options içinden bul
  const selectedOption = isMulti 
    ? options?.filter(opt => value?.includes(opt.value)) || []
    : options?.find(opt => opt.value === value) || null;

  const handleChange = (selected) => {
    if (isMulti) {
      onChange(selected ? selected.map(s => s.value) : []);
    } else {
      onChange(selected ? selected.value : '');
    }
  };

  // Dark tema için özel stiller
  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      borderRadius: 'calc(var(--radius) - 2px)',
      '&:hover': { 
        borderColor: 'hsl(var(--ring))' 
      },
      boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring) / 0.2)' : 'none',
      minHeight: '40px',
      cursor: 'pointer',
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'calc(var(--radius) - 2px)',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      zIndex: 9999,
      overflow: 'hidden',
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      maxHeight: '250px',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? 'hsl(var(--primary))' 
        : state.isFocused 
          ? 'hsl(var(--accent))' 
          : 'transparent',
      color: state.isSelected 
        ? 'hsl(var(--primary-foreground))' 
        : 'hsl(var(--popover-foreground))',
      borderRadius: 'calc(var(--radius) - 4px)',
      padding: '8px 12px',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: 'hsl(var(--accent))',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: 'hsl(var(--foreground))',
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--accent))',
      borderRadius: 'calc(var(--radius) - 4px)',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'hsl(var(--accent-foreground))',
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: 'hsl(var(--accent-foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--destructive))',
        color: 'hsl(var(--destructive-foreground))',
      },
    }),
    input: (base) => ({
      ...base,
      color: 'hsl(var(--foreground))',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      padding: '12px',
    }),
    loadingMessage: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--border))',
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      '&:hover': {
        color: 'hsl(var(--foreground))',
      },
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : null,
      transition: 'transform 0.2s ease',
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      '&:hover': {
        color: 'hsl(var(--destructive))',
      },
    }),
  };

  // Türkçe karakterlere uyumlu arama
  const filterOption = (option, inputValue) => {
    if (!inputValue) return true;
    
    const label = (option.label || '').toString().toLowerCase();
    const search = inputValue.toLowerCase();
    
    // Türkçe karakter dönüşümü
    const turkishMap = {
      'ı': 'i', 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ö': 'o', 'ç': 'c',
      'İ': 'i', 'Ğ': 'g', 'Ü': 'u', 'Ş': 's', 'Ö': 'o', 'Ç': 'c'
    };
    
    const normalize = (str) => {
      return str.split('').map(char => turkishMap[char] || char).join('');
    };
    
    return label.includes(search) || normalize(label).includes(normalize(search));
  };

  return (
    <Select
      options={options}
      value={selectedOption}
      onChange={handleChange}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isClearable={isClearable}
      isLoading={isLoading}
      isMulti={isMulti}
      noOptionsMessage={() => noOptionsMessage}
      loadingMessage={() => 'Yükleniyor...'}
      styles={customStyles}
      className={className}
      classNamePrefix="searchable-select"
      isSearchable={true}
      filterOption={filterOption}
      menuPlacement={menuPlacement}
      menuShouldScrollIntoView={false}
    />
  );
};

export default SearchableSelect;
