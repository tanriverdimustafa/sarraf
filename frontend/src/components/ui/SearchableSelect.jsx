/**
 * SearchableSelect - Aranabilir Combobox Component
 * react-select tabanlı, dark/light theme uyumlu
 */

import React from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

// Theme-aware custom styles
const getCustomStyles = (isDark = true) => ({
  control: (base, state) => ({
    ...base,
    backgroundColor: isDark ? 'hsl(var(--background))' : '#fff',
    borderColor: state.isFocused 
      ? 'hsl(var(--primary))' 
      : 'hsl(var(--border))',
    borderRadius: 'calc(var(--radius) - 2px)',
    minHeight: '40px',
    boxShadow: state.isFocused 
      ? '0 0 0 2px hsl(var(--primary) / 0.2)' 
      : 'none',
    '&:hover': { 
      borderColor: 'hsl(var(--primary))' 
    },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: isDark ? 'hsl(var(--popover))' : '#fff',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'calc(var(--radius) - 2px)',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 9999,
    overflow: 'hidden',
  }),
  menuList: (base) => ({
    ...base,
    padding: '4px',
    maxHeight: '300px',
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
      backgroundColor: 'hsl(var(--accent))' 
    },
  }),
  singleValue: (base) => ({
    ...base,
    color: 'hsl(var(--foreground))',
  }),
  input: (base) => ({
    ...base,
    color: 'hsl(var(--foreground))',
  }),
  placeholder: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: 'hsl(var(--border))',
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused 
      ? 'hsl(var(--primary))' 
      : 'hsl(var(--muted-foreground))',
    '&:hover': { 
      color: 'hsl(var(--primary))' 
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
    '&:hover': { 
      color: 'hsl(var(--destructive))' 
    },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'hsl(var(--accent))',
    borderRadius: 'calc(var(--radius) - 4px)',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'hsl(var(--accent-foreground))',
    padding: '2px 6px',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
    '&:hover': {
      backgroundColor: 'hsl(var(--destructive))',
      color: 'hsl(var(--destructive-foreground))',
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
    padding: '8px 12px',
  }),
  loadingMessage: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
  }),
  group: (base) => ({
    ...base,
    paddingTop: 0,
  }),
  groupHeading: (base) => ({
    ...base,
    color: 'hsl(var(--muted-foreground))',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    padding: '8px 12px 4px',
  }),
});

/**
 * SearchableSelect Component
 * 
 * @param {Array} options - [{value, label, ...}] formatında seçenekler
 * @param {any} value - Seçili değer (value field)
 * @param {Function} onChange - Değişiklik callback'i (value döner)
 * @param {string} placeholder - Placeholder text
 * @param {boolean} isSearchable - Arama aktif mi
 * @param {boolean} isClearable - Temizlenebilir mi
 * @param {boolean} isDisabled - Devre dışı mı
 * @param {boolean} isLoading - Yükleniyor mu
 * @param {boolean} isMulti - Çoklu seçim mi
 * @param {boolean} isCreatable - Yeni değer oluşturulabilir mi
 * @param {Function} noOptionsMessage - Sonuç yok mesajı
 * @param {Function} formatOptionLabel - Custom option render
 * @param {string} className - Ek CSS class
 */
export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Seçiniz...',
  isSearchable = true,
  isClearable = false,
  isDisabled = false,
  isLoading = false,
  isMulti = false,
  isCreatable = false,
  noOptionsMessage = () => 'Sonuç bulunamadı',
  loadingMessage = () => 'Yükleniyor...',
  formatOptionLabel,
  filterOption,
  className = '',
  menuPlacement = 'auto',
  menuPortalTarget,
  ...props
}) {
  // Değeri option formatına çevir
  const selectedValue = React.useMemo(() => {
    if (isMulti) {
      if (!value || !Array.isArray(value)) return [];
      return value.map(v => options.find(opt => opt.value === v)).filter(Boolean);
    }
    if (value === null || value === undefined || value === '') return null;
    return options.find(opt => opt.value === value) || null;
  }, [value, options, isMulti]);

  // onChange handler
  const handleChange = React.useCallback((selected) => {
    if (isMulti) {
      onChange(selected ? selected.map(s => s.value) : []);
    } else {
      onChange(selected?.value ?? null);
    }
  }, [onChange, isMulti]);

  const SelectComponent = isCreatable ? CreatableSelect : Select;
  const customStyles = getCustomStyles();

  return (
    <SelectComponent
      options={options}
      value={selectedValue}
      onChange={handleChange}
      placeholder={placeholder}
      isSearchable={isSearchable}
      isClearable={isClearable}
      isDisabled={isDisabled}
      isLoading={isLoading}
      isMulti={isMulti}
      noOptionsMessage={noOptionsMessage}
      loadingMessage={loadingMessage}
      formatOptionLabel={formatOptionLabel}
      filterOption={filterOption}
      styles={customStyles}
      className={`searchable-select ${className}`}
      classNamePrefix="select"
      menuPlacement={menuPlacement}
      menuPortalTarget={menuPortalTarget || (typeof document !== 'undefined' ? document.body : null)}
      menuPosition="fixed"
      {...props}
    />
  );
}

/**
 * Helper: Cari/Party options oluştur
 */
export function createPartyOptions(parties = []) {
  return parties.map(p => ({
    value: p.id,
    label: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.company_name || 'İsimsiz',
    type: p.party_type_id === 1 ? 'Müşteri' : p.party_type_id === 2 ? 'Tedarikçi' : '',
    phone: p.phone,
    // Custom display
    party: p,
  }));
}

/**
 * Helper: Ürün options oluştur
 */
export function createProductOptions(products = []) {
  return products.map(p => ({
    value: p.id,
    label: `${p.name} - ${p.karat_name || ''} ${p.weight_gram ? `(${p.weight_gram}g)` : ''}`,
    product: p,
    stock: p.stock_status_name || '',
    karat: p.karat_name,
    weight: p.weight_gram,
  }));
}

/**
 * Helper: Karat/Ayar options oluştur
 */
export function createKaratOptions(karats = []) {
  return karats.map(k => ({
    value: k.id,
    label: k.name || `${k.karat}`,
    fineness: k.fineness,
    karat: k,
  }));
}

/**
 * Helper: Ürün Tipi options oluştur
 */
export function createProductTypeOptions(productTypes = []) {
  return productTypes.map(pt => ({
    value: pt.id,
    label: `${pt.name}${pt.default_weight_gram ? ` (${pt.default_weight_gram}g)` : ''}`,
    productType: pt,
    isGoldBased: pt.is_gold_based,
    defaultWeight: pt.default_weight_gram,
  }));
}

/**
 * Helper: Kasa options oluştur
 */
export function createCashRegisterOptions(cashRegisters = []) {
  return cashRegisters.map(cr => ({
    value: cr.id,
    label: `${cr.name} (${cr.currency || 'TRY'})`,
    currency: cr.currency,
    cashRegister: cr,
  }));
}

/**
 * Helper: Ödeme Yöntemi options oluştur
 */
export function createPaymentMethodOptions(paymentMethods = []) {
  return paymentMethods.map(pm => ({
    value: pm.code || pm.id,
    label: pm.name,
    currency: pm.currency,
    type: pm.type,
    paymentMethod: pm,
  }));
}

/**
 * Custom Option Renderer - Cari için
 */
export function PartyOptionLabel({ label, type, phone }) {
  return (
    <div className="flex items-center justify-between w-full">
      <span>{label}</span>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {type && <span className="px-1.5 py-0.5 bg-accent rounded">{type}</span>}
        {phone && <span>{phone}</span>}
      </div>
    </div>
  );
}

/**
 * Custom Option Renderer - Ürün için
 */
export function ProductOptionLabel({ label, karat, weight, stock }) {
  return (
    <div className="flex items-center justify-between w-full">
      <span>{label}</span>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {stock && <span className="px-1.5 py-0.5 bg-green-500/20 text-green-500 rounded">{stock}</span>}
      </div>
    </div>
  );
}

export default SearchableSelect;
