import React, { useState, useEffect } from 'react';
import { Upload, X, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon, Package, Tag, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { BRANDS } from '@/data/mockData';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';
import useSellerStatus from '@/src/hooks/useSellerStatus';

export interface ExistingImage {
  id?: string;
  url: string;
  isThumbnail?: boolean;
}

interface NewListingFormProps {
  editingListing?: any;
  mode?: 'create' | 'edit' | 'restock';
  newListing?: any;
  setNewListing?: React.Dispatch<React.SetStateAction<any>>;
  handleCreateListing?: (e: React.FormEvent) => void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const CATEGORY_SUBCATEGORIES_MAP: Record<string, string[]> = {
  'Unstitched': [
    '3 Piece Lawn',
    '2 Piece Lawn',
    '1 Piece / Shirt',
    'Chiffon Suits',
    'Linen Suits',
    'Khaddar Suits',
    'Cotton Suits',
    'Cambric Suits',
    'Printed Unstitched',
    'Embroidered Unstitched',
    'Digital Printed',
    'Jacquard / Silk',
  ],
  'Ready to Wear': [
    'Printed Kurtis',
    'Embroidered Kurtis',
    '2 Piece Pret',
    '3 Piece Pret',
    'Luxury Pret',
    'Velvet Pret',
    'Casual Pret',
    'Office / Workwear',
    'Co-Ord Sets',
    'Long Shirts',
    'Trousers & Pants',
  ],
  'Formal': [
    'Chiffon Formals',
    'Organza Dupatta Suit',
    'Embroidered Formal',
    'Luxury Formal',
    'Party Wear',
    'Wedding Guest',
    'Silk Formal',
    'Velvet Formal',
    'Long Frocks',
    'Gharara / Sharara',
    'Maxi',
    'Peplum Suits',
  ],
  'Formals': [
    'Chiffon Formals',
    'Organza Dupatta Suit',
    'Embroidered Formal',
    'Luxury Formal',
    'Party Wear',
    'Wedding Guest',
    'Silk Formal',
    'Velvet Formal',
    'Long Frocks',
    'Gharara / Sharara',
    'Maxi',
    'Peplum Suits',
  ],
  'Accessories': [
    'Bags',
    'Jewellery',
    'Bangles',
    'Clutches',
    'Handbags',
    'Wallets',
    'Scarves / Stoles',
    'Hair Accessories',
    'Bridal Jewellery',
    'Artificial Jewellery',
    'Rings',
    'Earrings',
    'Necklaces',
    'Bracelets',
  ],
};

function parseSupabaseError(err: any): string {
  if (!err) return 'An unexpected error occurred while saving your collection. Please try again.';

  const message = (err.message || err.error_description || String(err)).toLowerCase();

  if (message.includes('bucket not found') || message.includes('bucket')) {
    return 'Storage configuration issue: Product image storage bucket not found. Please contact support.';
  }
  if (message.includes('row-level security') || message.includes('policy') || message.includes('permission denied')) {
    return 'Permission denied: You can only edit or restock your own listings.';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
    return 'Network error: Unable to connect to server. Please check your internet connection and try again.';
  }
  if (message.includes('violates foreign key constraint') || message.includes('seller_id')) {
    return 'Seller verification issue: Your seller profile could not be verified. Please re-login.';
  }

  return err.message || 'Failed to save collection listing. Please check your information and try again.';
}

export const NewListingForm: React.FC<NewListingFormProps> = ({
  editingListing = null,
  mode = 'create',
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const {
    status: sellerStatus,
    isRestricted,
    messages: restrictionMessages,
    badgeText,
    formattedRestrictedUntil,
    loading: statusLoading,
  } = useSellerStatus();
  const isEditMode = (mode === 'edit' || mode === 'restock' || !!editingListing);
  const isRestockMode = mode === 'restock';

  const [formData, setFormData] = useState({
    suit_title: '',
    brand: BRANDS[0] || 'Khaadi',
    fabric: '',
    stitching_status: 'Unstitched',
    piece_count: CATEGORY_SUBCATEGORIES_MAP['Unstitched'][0],
    quantity: '1',
    color: '',
    original_retail_price: '',
    surplus_selling_price: '',
    defect: 'None (100% Mint Factory Surplus)',
    description: '',
  });

  const [selectedSizes, setSelectedSizes] = useState<Record<string, number>>({});
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const isSizeBasedCategory = ['Ready to Wear', 'Formal', 'Formals', 'Bridal', 'Bridal Wear'].includes(formData.stitching_status);

  useEffect(() => {
    if (editingListing) {
      const cat = editingListing.category || editingListing.stitching_status || 'Unstitched';
      const subcatOptions = CATEGORY_SUBCATEGORIES_MAP[cat] || CATEGORY_SUBCATEGORIES_MAP['Unstitched'];
      const subcat = String(editingListing.subcategory || editingListing.piece_count || subcatOptions[0]);

      setFormData({
        suit_title: editingListing.suit_title || editingListing.title || '',
        brand: editingListing.brand || BRANDS[0] || 'Khaadi',
        fabric: editingListing.fabric || '',
        stitching_status: cat,
        piece_count: subcat,
        quantity: '1',
        color: editingListing.color || '',
        original_retail_price: String(editingListing.original_retail_price || editingListing.originalPrice || ''),
        surplus_selling_price: String(editingListing.surplus_selling_price || editingListing.price || ''),
        defect: editingListing.defect || 'None (100% Mint Factory Surplus)',
        description: editingListing.description || '',
      });

      if (editingListing.product_images && Array.isArray(editingListing.product_images) && editingListing.product_images.length > 0) {
        setExistingImages(
          editingListing.product_images.map((img: any) => ({
            id: img.id,
            url: img.image_url || img.url,
            isThumbnail: !!img.is_thumbnail,
          }))
        );
      } else if (editingListing.image) {
        const imgs = [editingListing.image, ...(editingListing.additionalImages || [])];
        setExistingImages(imgs.map((url: string, idx: number) => ({ url, isThumbnail: idx === 0 })));
      } else {
        setExistingImages([]);
      }

      // Populate size variants / Unstitched quantity
      const rawVariants = editingListing.product_variants || editingListing.variants;
      if (rawVariants && Array.isArray(rawVariants) && rawVariants.length > 0) {
        const map: Record<string, number> = {};
        let unstitchedQty = 1;
        rawVariants.forEach((v: any) => {
          if (v.size === 'Unstitched') {
            unstitchedQty = Number(v.quantity) || 1;
          } else if (v.size) {
            map[v.size] = Number(v.quantity) || 0;
          }
        });
        setSelectedSizes(map);
        setFormData((prev) => ({ ...prev, quantity: String(unstitchedQty) }));
      } else if (editingListing.id) {
        supabase
          .from('product_variants')
          .select('*')
          .eq('product_id', editingListing.id)
          .then(({ data }) => {
            if (data && data.length > 0) {
              const map: Record<string, number> = {};
              let unstitchedQty = 1;
              data.forEach((v: any) => {
                if (v.size === 'Unstitched') {
                  unstitchedQty = Number(v.quantity) || 1;
                } else if (v.size) {
                  map[v.size] = Number(v.quantity) || 0;
                }
              });
              setSelectedSizes(map);
              setFormData((prev) => ({ ...prev, quantity: String(unstitchedQty) }));
            } else {
              setSelectedSizes({});
            }
          });
      } else {
        setSelectedSizes({});
      }
    } else {
      setFormData({
        suit_title: '',
        brand: BRANDS[0] || 'Khaadi',
        fabric: '',
        stitching_status: 'Unstitched',
        piece_count: CATEGORY_SUBCATEGORIES_MAP['Unstitched'][0],
        quantity: '1',
        color: '',
        original_retail_price: '',
        surplus_selling_price: '',
        defect: 'None (100% Mint Factory Surplus)',
        description: '',
      });
      setExistingImages([]);
      setSelectedSizes({});
    }

    previews.forEach((p) => URL.revokeObjectURL(p));
    setSelectedFiles([]);
    setPreviews([]);
    setErrors({});
    setSubmitError(null);
    setSubmitSuccess(null);
  }, [editingListing, mode]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleCategoryChange = (newCategory: string) => {
    const availableSubcats = CATEGORY_SUBCATEGORIES_MAP[newCategory] || CATEGORY_SUBCATEGORIES_MAP['Unstitched'];
    setFormData((prev) => ({
      ...prev,
      stitching_status: newCategory,
      piece_count: availableSubcats[0] || '',
    }));
    if (errors.stitching_status) {
      setErrors((prev) => ({ ...prev, stitching_status: '' }));
    }
    if (errors.piece_count) {
      setErrors((prev) => ({ ...prev, piece_count: '' }));
    }
  };

  const handleToggleSize = (sizeName: string) => {
    setSelectedSizes((prev) => {
      const next = { ...prev };
      if (sizeName in next) {
        delete next[sizeName];
      } else {
        next[sizeName] = 1;
      }
      return next;
    });
    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }
  };

  const handleSizeQtyChange = (sizeName: string, valStr: string) => {
    const num = parseInt(valStr, 10);
    const qtyVal = isNaN(num) ? 0 : Math.max(0, num);
    setSelectedSizes((prev) => ({
      ...prev,
      [sizeName]: qtyVal,
    }));
    if (errors.quantity) {
      setErrors((prev) => ({ ...prev, quantity: '' }));
    }
  };

  const totalImageCount = existingImages.length + selectedFiles.length;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    const availableSlots = 4 - totalImageCount;
    if (availableSlots <= 0) {
      setErrors((prev) => ({ ...prev, images: 'Maximum 4 images allowed per collection.' }));
      return;
    }

    const filesToAdd = files.slice(0, availableSlots);
    const newSelected = [...selectedFiles, ...filesToAdd];
    const newPreviews = filesToAdd.map((file) => URL.createObjectURL(file));

    setSelectedFiles(newSelected);
    setPreviews((prev) => [...prev, ...newPreviews]);
    if (errors.images) {
      setErrors((prev) => ({ ...prev, images: '' }));
    }
  };

  const handleRemoveExistingImage = (index: number) => {
    const newExisting = existingImages.filter((_, i) => i !== index);
    setExistingImages(newExisting);
    if (newExisting.length + selectedFiles.length === 0) {
      setErrors((prev) => ({ ...prev, images: 'Please keep at least 1 image for your collection.' }));
    } else {
      setErrors((prev) => ({ ...prev, images: '' }));
    }
  };

  const handleRemoveSelectedFile = (index: number) => {
    if (previews[index]) {
      URL.revokeObjectURL(previews[index]);
    }
    const newSelected = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setSelectedFiles(newSelected);
    setPreviews(newPreviews);
    if (existingImages.length + newSelected.length === 0) {
      setErrors((prev) => ({ ...prev, images: 'Please select at least 1 collection image.' }));
    } else {
      setErrors((prev) => ({ ...prev, images: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const currentTotal = existingImages.length + selectedFiles.length;
    if (currentTotal === 0) {
      newErrors.images = 'Please upload at least 1 image for your collection (maximum 4 allowed).';
    } else if (currentTotal > 4) {
      newErrors.images = 'You cannot upload more than 4 images per collection.';
    }

    if (!formData.suit_title.trim()) {
      newErrors.suit_title = 'Suit Title is required.';
    } else if (formData.suit_title.trim().length < 3) {
      newErrors.suit_title = 'Suit Title must be at least 3 characters long.';
    }

    if (!formData.brand.trim()) {
      newErrors.brand = 'Brand selection is required.';
    }

    if (!formData.fabric.trim()) {
      newErrors.fabric = 'Fabric Type is required (e.g. Lawn, Chiffon, Organza).';
    }

    if (!formData.stitching_status) {
      newErrors.stitching_status = 'Category selection is required.';
    }

    if (!formData.piece_count) {
      newErrors.piece_count = 'Subcategory selection is required.';
    }

    if (isSizeBasedCategory) {
      const selectedKeys = Object.keys(selectedSizes);
      if (selectedKeys.length === 0) {
        newErrors.quantity = 'Please select at least one stock size (Small, Medium, Large, X Large).';
      } else {
        const invalidSizes = selectedKeys.filter((sz) => !selectedSizes[sz] || selectedSizes[sz] < 1);
        if (invalidSizes.length > 0) {
          newErrors.quantity = `Please enter a valid stock quantity (> 0) for all selected sizes: ${invalidSizes.join(', ')}.`;
        }
      }
    } else {
      const qty = parseInt(formData.quantity, 10);
      if (!formData.quantity || isNaN(qty) || qty < 1) {
        newErrors.quantity = 'Stock quantity is required and must be at least 1 piece.';
      }
    }

    const origPrice = parseFloat(formData.original_retail_price);
    if (!formData.original_retail_price || isNaN(origPrice) || origPrice <= 0) {
      newErrors.original_retail_price = 'Retail Price is required and must be greater than 0.';
    }

    const surplusPrice = parseFloat(formData.surplus_selling_price);
    if (!formData.surplus_selling_price || isNaN(surplusPrice) || surplusPrice <= 0) {
      newErrors.surplus_selling_price = 'Discounted Price is required and must be greater than 0.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    setSubmitSuccess(null);

    const isValid = validateForm();
    if (!isValid) {
      setSubmitError('Please review and correct the highlighted fields.');
      return;
    }

    setIsSubmitting(true);

    const sellerId = user?.id;
    if (!sellerId) {
      setSubmitError('Authentication Error: Seller ID not found. Please log in to your seller account.');
      setIsSubmitting(false);
      return;
    }

    const targetBucket = 'products';
    const uploadedStoragePaths: { path: string; bucket: string }[] = [];

    try {
      const totalStockQty = isSizeBasedCategory
        ? Object.values(selectedSizes).reduce((sum, q) => sum + (Number(q) || 0), 0)
        : Math.max(1, parseInt(formData.quantity, 10));

      if (isEditMode && editingListing?.id) {
        const newStatus = (editingListing.status === 'Sold Out' || totalStockQty > 0)
          ? 'Active'
          : (editingListing.status || 'Active');

        // Note: products table does NOT contain quantity or stitching_status columns!
        const { error: updateError } = await supabase
          .from('products')
          .update({
            brand: formData.brand.trim(),
            suit_title: formData.suit_title.trim(),
            category: formData.stitching_status,
            subcategory: formData.piece_count,
            fabric: formData.fabric.trim() || null,
            piece_count: 1,
            color: formData.color.trim() || null,
            original_retail_price: parseFloat(formData.original_retail_price),
            surplus_selling_price: parseFloat(formData.surplus_selling_price),
            defect: formData.defect ? formData.defect.trim() : null,
            description: formData.description ? formData.description.trim() : null,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingListing.id)
          .eq('seller_id', sellerId);

        if (updateError) {
          throw new Error(parseSupabaseError(updateError));
        }

        // Manage product images
        const newImageRecords: { product_id: string; image_url: string; is_thumbnail: boolean }[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${Date.now()}_${i}_${cleanFileName}`;
          const filePath = `${editingListing.id}/${fileName}`;

          const uploadRes = await supabase.storage.from(targetBucket).upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

          if (uploadRes.error) {
            throw new Error(`Image upload failed for "${file.name}": ${parseSupabaseError(uploadRes.error)}`);
          }

          uploadedStoragePaths.push({ path: filePath, bucket: targetBucket });

          const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            newImageRecords.push({
              product_id: editingListing.id,
              image_url: urlData.publicUrl,
              is_thumbnail: existingImages.length === 0 && i === 0,
            });
          }
        }

        if (newImageRecords.length > 0) {
          const { error: imgInsertErr } = await supabase.from('product_images').insert(newImageRecords);
          if (imgInsertErr) {
            console.warn('Error inserting product images:', imgInsertErr);
          }
        }

        if (editingListing.product_images && Array.isArray(editingListing.product_images)) {
          const remainingUrls = new Set(existingImages.map((img) => img.url));
          const removedImages = editingListing.product_images.filter((img: any) => !remainingUrls.has(img.image_url));

          for (const removed of removedImages) {
            if (removed.id) {
              await supabase.from('product_images').delete().eq('id', removed.id);
            }
          }
        }

        const topUrl = existingImages[0]?.url || newImageRecords[0]?.image_url;
        if (topUrl && editingListing.id) {
          await supabase.from('product_images').update({ is_thumbnail: false }).eq('product_id', editingListing.id);
          await supabase.from('product_images').update({ is_thumbnail: true }).eq('product_id', editingListing.id).eq('image_url', topUrl);
        }

        // Manage product_variants: Delete existing and re-insert
        await supabase.from('product_variants').delete().eq('product_id', editingListing.id);

        if (isSizeBasedCategory) {
          const variantRecords = Object.entries(selectedSizes)
            .filter(([_, qty]) => Number(qty) > 0)
            .map(([sz, qty]) => ({
              product_id: editingListing.id,
              size: sz,
              quantity: Number(qty),
            }));
          if (variantRecords.length > 0) {
            const { error: varErr } = await supabase.from('product_variants').insert(variantRecords);
            if (varErr) {
              console.warn('Error updating product_variants:', varErr);
            }
          }
        } else {
          // Unstitched variant
          const { error: varErr } = await supabase.from('product_variants').insert([
            {
              product_id: editingListing.id,
              size: 'Unstitched',
              quantity: Math.max(1, parseInt(formData.quantity, 10)),
            },
          ]);
          if (varErr) {
            console.warn('Error updating Unstitched variant:', varErr);
          }
        }

        setSubmitSuccess(
          isRestockMode
            ? '🎉 Collection restocked successfully!'
            : '🎉 Collection updated successfully!'
        );
      } else {
        let createdProductId: string | null = null;

        // Note: products table does NOT contain quantity or stitching_status columns!
        const { data: product, error: productError } = await supabase
          .from('products')
          .insert({
            seller_id: sellerId,
            brand: formData.brand.trim(),
            suit_title: formData.suit_title.trim(),
            category: formData.stitching_status,
            subcategory: formData.piece_count,
            fabric: formData.fabric.trim() || null,
            piece_count: 1,
            color: formData.color.trim() || null,
            original_retail_price: parseFloat(formData.original_retail_price),
            surplus_selling_price: parseFloat(formData.surplus_selling_price),
            defect: formData.defect ? formData.defect.trim() : null,
            description: formData.description ? formData.description.trim() : null,
            status: 'Active',
          })
          .select('id')
          .single();

        if (productError || !product?.id) {
          throw new Error(parseSupabaseError(productError));
        }

        createdProductId = product.id;

        // Insert variants into product_variants table
        if (isSizeBasedCategory) {
          const variantRecords = Object.entries(selectedSizes)
            .filter(([_, qty]) => Number(qty) > 0)
            .map(([sz, qty]) => ({
              product_id: createdProductId,
              size: sz,
              quantity: Number(qty),
            }));

          if (variantRecords.length > 0) {
            const { error: varErr } = await supabase.from('product_variants').insert(variantRecords);
            if (varErr) {
              throw new Error(`Failed to save size variants: ${parseSupabaseError(varErr)}`);
            }
          }
        } else {
          // Single Unstitched variant
          const { error: varErr } = await supabase.from('product_variants').insert([
            {
              product_id: createdProductId,
              size: 'Unstitched',
              quantity: Math.max(1, parseInt(formData.quantity, 10)),
            },
          ]);
          if (varErr) {
            throw new Error(`Failed to save stock quantity: ${parseSupabaseError(varErr)}`);
          }
        }

        // Upload and insert product_images
        const uploadedImages: { url: string; isThumbnail: boolean }[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${Date.now()}_${i}_${cleanFileName}`;
          const filePath = `${createdProductId}/${fileName}`;

          const uploadRes = await supabase.storage.from(targetBucket).upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

          if (uploadRes.error) {
            throw new Error(`Image upload failed for "${file.name}": ${parseSupabaseError(uploadRes.error)}`);
          }

          uploadedStoragePaths.push({ path: filePath, bucket: targetBucket });

          const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
          if (!urlData?.publicUrl) {
            throw new Error(`Could not generate public URL for photo "${file.name}".`);
          }

          uploadedImages.push({
            url: urlData.publicUrl,
            isThumbnail: i === 0,
          });
        }

        const imageRecords = uploadedImages.map((img) => ({
          product_id: createdProductId,
          image_url: img.url,
          is_thumbnail: img.isThumbnail,
        }));

        const { error: imageDbError } = await supabase.from('product_images').insert(imageRecords);
        if (imageDbError) {
          throw new Error(parseSupabaseError(imageDbError));
        }

        setSubmitSuccess('🎉 Collection created successfully with all details, variants and images!');

        setFormData({
          suit_title: '',
          brand: BRANDS[0] || 'Khaadi',
          fabric: '',
          stitching_status: 'Unstitched',
          piece_count: CATEGORY_SUBCATEGORIES_MAP['Unstitched'][0],
          quantity: '1',
          color: '',
          original_retail_price: '',
          surplus_selling_price: '',
          defect: 'None (100% Mint Factory Surplus)',
          description: '',
        });
        setSelectedSizes({});
        previews.forEach((p) => URL.revokeObjectURL(p));
        setSelectedFiles([]);
        setPreviews([]);
        setExistingImages([]);
        setErrors({});
      }

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 800);
      }
    } catch (err: any) {
      console.error('NewListingForm error:', err);
      setSubmitError(err?.message || 'An unexpected error occurred while saving the collection.');

      if (uploadedStoragePaths.length > 0) {
        for (const item of uploadedStoragePaths) {
          try {
            await supabase.storage.from(item.bucket).remove([item.path]);
          } catch (cleanupErr) {
            console.warn('Storage cleanup warning:', cleanupErr);
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFormTitle = () => {
    if (isRestockMode) return 'RESTOCK COLLECTION';
    if (isEditMode) return 'UPDATE COLLECTION';
    return 'CREATE NEW COLLECTION';
  };

  const getButtonText = () => {
    if (isSubmitting) {
      if (isRestockMode) return 'RESTOCKING COLLECTION...';
      if (isEditMode) return 'SAVING CHANGES...';
      return 'UPLOADING IMAGES & SAVING COLLECTION...';
    }
    if (isRestockMode) return 'UPDATE STOCK / RESTOCK COLLECTION';
    if (isEditMode) return 'UPDATE COLLECTION';
    return 'ADD COLLECTION';
  };

  const currentCategory = formData.stitching_status;
  const currentSubcategoryOptions = CATEGORY_SUBCATEGORIES_MAP[currentCategory] || CATEGORY_SUBCATEGORIES_MAP['Unstitched'];

  if (statusLoading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center flex flex-col items-center justify-center space-y-3 min-h-[300px]">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-xs sm:text-sm font-semibold text-stone-600">Verifying seller account status...</p>
      </div>
    );
  }

  if (isRestricted) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-6 sm:p-8 w-full max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start space-y-3 sm:space-y-0 sm:space-x-4 p-5 sm:p-6 bg-red-50/90 border border-red-200 rounded-xl">
          <ShieldAlert className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-3 w-full">
            <h3 className="text-base sm:text-lg font-bold text-red-900 uppercase tracking-wide">
              Account Status: {badgeText}
            </h3>
            <div className="space-y-2">
              {restrictionMessages.map((msg, idx) => (
                <p key={idx} className="text-xs sm:text-sm text-red-800 leading-relaxed font-medium flex items-start space-x-2">
                  {restrictionMessages.length > 1 && <span className="font-bold shrink-0">•</span>}
                  <span>{msg}</span>
                </p>
              ))}
              {formattedRestrictedUntil ? (
                <span className="block mt-2 font-semibold text-red-900 text-xs sm:text-sm">
                  Your account is restricted until {formattedRestrictedUntil}.
                </span>
              ) : null}
            </div>
            <p className="text-[11px] sm:text-xs text-red-600/90 pt-2 border-t border-red-200/80">
              Please contact marketplace support if you require assistance with your seller account status.
            </p>
          </div>
        </div>

        {onCancel && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-md border border-stone-300 transition-colors cursor-pointer min-h-[38px]"
            >
              Back to Listings
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-4 sm:p-6 lg:p-8 w-full max-w-8xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-stone-200 gap-3">
        <div>
          <h2 className="text-base sm:text-lg lg:text-xl font-extrabold uppercase tracking-wider text-stone-900 flex items-center space-x-2">
            {isRestockMode ? (
              <RefreshCw className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <Package className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span>{getFormTitle()}</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            {isRestockMode
              ? 'Update stock quantity and availability for your existing collection.'
              : isEditMode
                ? 'Modify details and images for your existing collection listing.'
                : 'Upload suit photos and enter collection details below to list on Zebaish marketplace.'}
          </p>
        </div>

        {isEditMode && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-md border border-stone-300 transition-colors cursor-pointer shrink-0 min-h-[38px]"
          >
            Cancel Edit
          </button>
        )}
      </div>

      {submitError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-md flex items-center space-x-3 text-xs text-red-700 font-medium">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {submitSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md flex items-center space-x-3 text-xs text-emerald-800 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6 text-xs sm:text-sm">
        {/* SECTION 1: Photography Gallery */}
        <div className="space-y-4 bg-stone-50/80 p-4 sm:p-5 rounded-xl border border-stone-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-200 pb-3 gap-2">
            <label className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
              <span>1. Collection Photography Gallery (Max 4 Images) <span className="text-red-600">*</span></span>
            </label>
            <span className="text-[11px] sm:text-xs text-stone-500 font-semibold">
              {totalImageCount} of 4 images uploaded
            </span>
          </div>

          {totalImageCount < 4 && (
            <label className="border-2 border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 transition-colors rounded-lg p-5 sm:p-8 flex flex-col items-center justify-center cursor-pointer text-center shadow-2xs">
              <Upload className="w-8 h-8 text-stone-500 mb-2" />
              <span className="font-bold text-stone-800 text-xs sm:text-sm uppercase tracking-wide mb-1">
                Click to browse or drag collection photos here
              </span>
              <span className="text-[11px] sm:text-xs text-stone-500 max-w-md">
                Supports JPG, PNG, WEBP (Max 4 images). The first image will be set as Primary Thumbnail.
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </label>
          )}

          {errors.images && (
            <p className="text-xs text-red-600 font-medium">{errors.images}</p>
          )}

          {totalImageCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2">
              {existingImages.map((img, index) => (
                <div
                  key={img.id || img.url || index}
                  className="relative group border border-stone-300 rounded-md overflow-hidden bg-stone-100 aspect-3/4 flex flex-col shadow-xs"
                >
                  <img
                    src={img.url}
                    alt={`Existing Image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full shadow-sm ${index === 0
                      ? 'bg-amber-400 text-stone-950'
                      : 'bg-stone-900/80 text-white backdrop-blur-xs'
                      }`}
                  >
                    {index === 0 ? 'Primary' : `Photo ${index + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingImage(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                    title="Remove Image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {previews.map((previewUrl, index) => {
                const combinedIndex = existingImages.length + index;
                return (
                  <div
                    key={previewUrl}
                    className="relative group border border-stone-300 rounded-md overflow-hidden bg-stone-100 aspect-3/4 flex flex-col shadow-xs"
                  >
                    <img
                      src={previewUrl}
                      alt={`New Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full shadow-sm ${combinedIndex === 0
                        ? 'bg-amber-400 text-stone-950'
                        : 'bg-emerald-600 text-white backdrop-blur-xs'
                        }`}
                    >
                      {combinedIndex === 0 ? 'Primary' : `New ${index + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSelectedFile(index)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer"
                      title="Remove Image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: Collection Details */}
        <div className="space-y-5">
          <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs sm:text-sm border-b border-stone-200 pb-2 flex items-center space-x-2">
            <Tag className="w-4 h-4 text-stone-500" />
            <span>2. Collection Specifications & Pricing</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Brand */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Brand <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.brand}
                onChange={(e) => handleInputChange('brand', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] ${errors.brand ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              {errors.brand && <p className="text-xs text-red-600 font-medium mt-1">{errors.brand}</p>}
            </div>

            {/* Suit Title */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Suit Title <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="Embroidered 3PC Lawn Suit"
                value={formData.suit_title}
                onChange={(e) => handleInputChange('suit_title', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${errors.suit_title ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.suit_title && <p className="text-xs text-red-600 font-medium mt-1">{errors.suit_title}</p>}
            </div>

            {/* Fabric Type */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Fabric Type <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="Lawn, Chiffon, Organza"
                value={formData.fabric}
                onChange={(e) => handleInputChange('fabric', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${errors.fabric ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.fabric && <p className="text-xs text-red-600 font-medium mt-1">{errors.fabric}</p>}
            </div>

            {/* Category Dropdown */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.stitching_status}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] ${errors.stitching_status ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
              >
                <option value="Unstitched">Unstitched</option>
                <option value="Ready to Wear">Ready to Wear</option>
                <option value="Formal">Formal</option>
              </select>
              {errors.stitching_status && (
                <p className="text-xs text-red-600 font-medium mt-1">{errors.stitching_status}</p>
              )}
            </div>

            {/* Subcategory Dropdown (Dependent on Category) */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Subcategory <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.piece_count}
                onChange={(e) => handleInputChange('piece_count', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] ${errors.piece_count ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
              >
                {currentSubcategoryOptions.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
              {errors.piece_count && <p className="text-xs text-red-600 font-medium mt-1">{errors.piece_count}</p>}
            </div>

            {/* Retail Price */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Retail Price <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-stone-400 font-bold text-xs">Rs</span>
                <input
                  type="number"
                  min="1"
                  placeholder="3500"
                  value={formData.original_retail_price}
                  onChange={(e) => handleInputChange('original_retail_price', e.target.value)}
                  className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] ${errors.original_retail_price
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                    }`}
                />
              </div>
              {errors.original_retail_price && (
                <p className="text-xs text-red-600 font-medium mt-1">{errors.original_retail_price}</p>
              )}
            </div>

            {/* Discounted Price */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Discounted Price <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-stone-400 font-bold text-xs">Rs</span>
                <input
                  type="number"
                  min="1"
                  placeholder="6500"
                  value={formData.surplus_selling_price}
                  onChange={(e) => handleInputChange('surplus_selling_price', e.target.value)}
                  className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] ${errors.surplus_selling_price
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-stone-300 focus:border-stone-900'
                    }`}
                />
              </div>
              {errors.surplus_selling_price && (
                <p className="text-xs text-red-600 font-medium mt-1">{errors.surplus_selling_price}</p>
              )}
            </div>
          </div>

          {/* Stock Section: Dynamic Size & Quantity for Ready to Wear / Formal / Bridal vs Single Qty for Unstitched / Accessories */}
          {isSizeBasedCategory ? (
            <div className="space-y-3 bg-stone-50 p-4 sm:p-5 rounded-xl border border-stone-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-stone-200 pb-2.5">
                <label className="font-bold text-stone-900 uppercase tracking-wide text-xs sm:text-sm">
                  Stock Size & Quantity <span className="text-red-600">*</span>
                </label>
                <span className="text-[11px] text-stone-500 font-medium">
                  Select available sizes and enter stock for each
                </span>
              </div>

              {/* Predefined Size Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {['Small', 'Medium', 'Large', 'X Large'].map((sz) => {
                  const isSelected = sz in selectedSizes;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handleToggleSize(sz)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${isSelected
                        ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 hover:border-stone-400'
                        }`}
                    >
                      {sz} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>

              {/* Compact Quantity Inputs for Selected Sizes */}
              {Object.keys(selectedSizes).length > 0 && (
                <div className="pt-3 border-t border-stone-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Small', 'Medium', 'Large', 'X Large']
                    .filter((sz) => sz in selectedSizes)
                    .map((sz) => (
                      <div key={`qty-${sz}`} className="bg-white p-3 rounded-lg border border-stone-200 shadow-2xs space-y-1.5">
                        <span className="text-xs font-bold text-stone-800 block">{sz} Quantity</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Qty"
                          value={selectedSizes[sz] !== undefined && selectedSizes[sz] !== 0 ? selectedSizes[sz] : ''}
                          onChange={(e) => handleSizeQtyChange(sz, e.target.value)}
                          className="w-full p-2 text-xs border border-stone-300 rounded-md focus:outline-none focus:border-stone-900 font-semibold bg-stone-50/50"
                        />
                      </div>
                    ))}
                </div>
              )}

              {errors.quantity && <p className="text-xs text-red-600 font-medium pt-1">{errors.quantity}</p>}
            </div>
          ) : (
            <div className="max-w-xs">
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Stock Quantity <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="5"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${errors.quantity ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
                  }`}
              />
              {errors.quantity && <p className="text-xs text-red-600 font-medium mt-1">{errors.quantity}</p>}
            </div>
          )}

          {/* Defect Disclaimer */}
          <div>
            <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">Defect / Flaw Disclaimer</label>
            <select
              value={formData.defect}
              onChange={(e) => handleInputChange('defect', e.target.value)}
              className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 bg-white min-h-[42px]"
            >
              <option value="None (100% Mint Factory Surplus)">
                None (100% Mint Factory Surplus)
              </option>
              <option value="Minor printing misalignment on hem">
                Minor printing misalignment on hem
              </option>
              <option value="Missing original brand cardboard tag">
                Missing original brand cardboard tag
              </option>
              <option value="End-of-season clearance roll leftover">
                End-of-season clearance roll leftover
              </option>
              <option value="Minor embroidery irregularity">
                Minor embroidery irregularity
              </option>
              <option value="Slight color variation from original batch">
                Slight color variation from original batch
              </option>
              <option value="Minor stitching imperfection">
                Minor stitching imperfection
              </option>
              <option value="Small fabric weaving irregularity">
                Small fabric weaving irregularity
              </option>
            </select>
          </div>

          {/* Detailed Description */}
          <div>
            <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              <span>Detailed Description & Fabric Breakdown</span>
            </label>
            <textarea
              rows={6}
              placeholder={`Shirt: Printed Centre Panel With Hand-Embellished Organza Detailing...\nTrouser: Printed Culotte Trouser...\nDupatta: Spray Embroidered Medium Silk...`}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 font-mono text-xs leading-relaxed"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-stone-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 sm:py-4 bg-stone-900 hover:bg-black disabled:bg-stone-500 text-white text-xs sm:text-sm font-bold uppercase tracking-widest rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>{getButtonText()}</span>
              </>
            ) : (
              <span>{getButtonText()}</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewListingForm;
