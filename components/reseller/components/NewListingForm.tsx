import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Package,
  Tag,
  FileText,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { BRANDS } from '@/data/mockData';
import supabase from '@/src/api/client';
import useAuth from '@/src/hooks/useAuth';
import useSellerStatus from '@/src/hooks/useSellerStatus';

export interface ExistingImage {
  id?: string;
  url: string;
  isThumbnail?: boolean;
}

export interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl: string | null;
  storagePath: string | null;
  status: 'uploading' | 'success' | 'error';
  errorMsg?: string;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function parseSupabaseError(err: any): string {
  if (!err) return 'An unexpected error occurred while saving your collection. Please try again.';

  const message = (err.message || err.error_description || String(err)).toLowerCase();

  if (message.includes('bucket not found') || message.includes('bucket')) {
    return 'Storage configuration issue: Product image storage bucket not found. Please contact support.';
  }
  if (message.includes('storage') || message.includes('object')) {
    return `Storage Upload Issue: ${err.message || 'Permission denied on storage bucket.'}`;
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

/**
 * Uploads a single image file to Supabase Storage immediately with Data URL fallback
 */
async function uploadSingleFileToStorage(
  file: File,
  sellerId: string,
  itemId: string
): Promise<{ publicUrl: string; path: string }> {
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${Date.now()}_${itemId}_${cleanFileName}`;
  const filePath = `${sellerId}/${fileName}`;
  const targetBucket = 'products';

  try {
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      console.warn(`Product image storage upload warning (using Data URL fallback):`, uploadError.message);
      const dataUrl = await fileToDataUrl(file);
      return { publicUrl: dataUrl, path: '' };
    }

    const { data: urlData } = supabase.storage.from(targetBucket).getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      const dataUrl = await fileToDataUrl(file);
      return { publicUrl: dataUrl, path: '' };
    }

    return { publicUrl: urlData.publicUrl, path: filePath };
  } catch (err: any) {
    console.warn(`Product image storage upload exception (using Data URL fallback):`, err?.message || err);
    const dataUrl = await fileToDataUrl(file);
    return { publicUrl: dataUrl, path: '' };
  }
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
  const isEditMode = mode === 'edit' || mode === 'restock' || !!editingListing;
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
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const uploadItemsRef = useRef<UploadItem[]>([]);
  uploadItemsRef.current = uploadItems;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const isSizeBasedCategory = ['Ready to Wear', 'Formal', 'Formals', 'Bridal', 'Bridal Wear'].includes(
    formData.stitching_status
  );

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

    uploadItemsRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setUploadItems([]);
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

  const totalImageCount = existingImages.length + uploadItems.length;

  // Background Upload Trigger Function
  const startBackgroundUpload = async (item: UploadItem, sellerId: string) => {
    try {
      const { publicUrl, path } = await uploadSingleFileToStorage(item.file, sellerId, item.id);
      setUploadItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'success', uploadedUrl: publicUrl, storagePath: path, errorMsg: undefined }
            : it
        )
      );
    } catch (err: any) {
      console.warn('Background image upload error:', err);
      setUploadItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: 'error', errorMsg: err?.message || 'Upload failed' }
            : it
        )
      );
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    const availableSlots = 4 - totalImageCount;
    if (availableSlots <= 0) {
      setErrors((prev) => ({ ...prev, images: 'Maximum 4 images allowed per collection.' }));
      return;
    }

    const filesToAdd = files.slice(0, availableSlots);
    const sellerId = user?.id || 'reseller';

    const newItems: UploadItem[] = filesToAdd.map((file, idx) => {
      const id = `img_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        uploadedUrl: null,
        storagePath: null,
        status: 'uploading',
      };
    });

    setUploadItems((prev) => [...prev, ...newItems]);
    if (errors.images) {
      setErrors((prev) => ({ ...prev, images: '' }));
    }

    // Trigger parallel background uploads immediately
    newItems.forEach((item) => {
      startBackgroundUpload(item, sellerId);
    });
  };

  const handleRetryUpload = (item: UploadItem) => {
    const sellerId = user?.id || 'reseller';
    setUploadItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading', errorMsg: undefined } : it))
    );
    startBackgroundUpload(item, sellerId);
  };

  const handleRemoveExistingImage = (index: number) => {
    const newExisting = existingImages.filter((_, i) => i !== index);
    setExistingImages(newExisting);
    if (newExisting.length + uploadItems.length === 0) {
      setErrors((prev) => ({ ...prev, images: 'Please keep at least 1 image for your collection.' }));
    } else {
      setErrors((prev) => ({ ...prev, images: '' }));
    }
  };

  const handleRemoveUploadItem = (itemId: string) => {
    setUploadItems((prev) => {
      const target = prev.find((it) => it.id === itemId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((it) => it.id !== itemId);
      if (existingImages.length + next.length === 0) {
        setErrors((errs) => ({ ...errs, images: 'Please select at least 1 collection image.' }));
      } else {
        setErrors((errs) => ({ ...errs, images: '' }));
      }
      return next;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const currentTotal = existingImages.length + uploadItems.length;
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

    // 1. Wait for any active background image uploads to settle
    let waitAttempts = 0;
    while (uploadItemsRef.current.some((it) => it.status === 'uploading') && waitAttempts < 40) {
      await new Promise((r) => setTimeout(r, 250));
      waitAttempts++;
    }

    // 2. Check for upload errors
    const currentUploads = uploadItemsRef.current;
    const failedUploads = currentUploads.filter((it) => it.status === 'error');

    if (failedUploads.length > 0) {
      setSubmitError('One or more selected images failed to upload. Please retry or remove failed images.');
      setIsSubmitting(false);
      return;
    }

    try {
      const totalStockQty = isSizeBasedCategory
        ? Object.values(selectedSizes).reduce((sum, q) => sum + (Number(q) || 0), 0)
        : Math.max(1, parseInt(formData.quantity, 10));

      if (isEditMode && editingListing?.id) {
        const newStatus = (editingListing.status === 'Sold Out' || totalStockQty > 0)
          ? 'Active'
          : (editingListing.status || 'Active');

        // Update product metadata in DB
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

        // Batch insert new image records using pre-uploaded URLs
        const newImageRecords = currentUploads
          .filter((it) => it.uploadedUrl)
          .map((it, i) => ({
            product_id: editingListing.id,
            image_url: it.uploadedUrl!,
            is_thumbnail: existingImages.length === 0 && i === 0,
          }));

        // Handle image records & variant updates in parallel
        const dbTasks: Promise<any>[] = [];

        if (newImageRecords.length > 0) {
          dbTasks.push(
            Promise.resolve(
              supabase.from('product_images').insert(newImageRecords).then(({ error }) => {
                if (error) console.warn('Error inserting product_images:', error);
              })
            )
          );
        }

        // Delete removed images if editing
        if (editingListing.product_images && Array.isArray(editingListing.product_images)) {
          const remainingUrls = new Set(existingImages.map((img) => img.url));
          const removedImages = editingListing.product_images.filter((img: any) => !remainingUrls.has(img.image_url));

          removedImages.forEach((removed: any) => {
            if (removed.id) {
              dbTasks.push(Promise.resolve(supabase.from('product_images').delete().eq('id', removed.id)));
            }
          });
        }

        // Update variants
        dbTasks.push(
          Promise.resolve(
            supabase
              .from('product_variants')
              .delete()
              .eq('product_id', editingListing.id)
              .then(async () => {
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
                    if (varErr) console.warn('Error updating product_variants:', varErr);
                  }
                } else {
                  const { error: varErr } = await supabase.from('product_variants').insert([
                    {
                      product_id: editingListing.id,
                      size: 'Unstitched',
                      quantity: Math.max(1, parseInt(formData.quantity, 10)),
                    },
                  ]);
                  if (varErr) console.warn('Error updating Unstitched variant:', varErr);
                }
              })
          )
        );

        await Promise.all(dbTasks);

        // Ensure thumbnail flag is updated
        const topUrl = existingImages[0]?.url || newImageRecords[0]?.image_url;
        if (topUrl && editingListing.id) {
          await supabase.from('product_images').update({ is_thumbnail: false }).eq('product_id', editingListing.id);
          await supabase
            .from('product_images')
            .update({ is_thumbnail: true })
            .eq('product_id', editingListing.id)
            .eq('image_url', topUrl);
        }

        setSubmitSuccess(
          isRestockMode ? '🎉 Collection restocked successfully!' : '🎉 Collection updated successfully!'
        );
      } else {
        // CREATE NEW LISTING
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

        const createdProductId = product.id;

        // Build image records using pre-uploaded URLs
        const imageRecords = currentUploads
          .filter((it) => it.uploadedUrl)
          .map((it, i) => ({
            product_id: createdProductId,
            image_url: it.uploadedUrl!,
            is_thumbnail: i === 0,
          }));

        // Build variant records
        const variantRecords = isSizeBasedCategory
          ? Object.entries(selectedSizes)
              .filter(([_, qty]) => Number(qty) > 0)
              .map(([sz, qty]) => ({
                product_id: createdProductId,
                size: sz,
                quantity: Number(qty),
              }))
          : [
              {
                product_id: createdProductId,
                size: 'Unstitched',
                quantity: Math.max(1, parseInt(formData.quantity, 10)),
              },
            ];

        // Execute Image and Variant inserts in PARALLEL
        await Promise.all([
          imageRecords.length > 0
            ? supabase.from('product_images').insert(imageRecords).then(({ error }) => {
                if (error) throw new Error(parseSupabaseError(error));
              })
            : Promise.resolve(),
          variantRecords.length > 0
            ? supabase.from('product_variants').insert(variantRecords).then(({ error }) => {
                if (error) throw new Error(`Failed to save stock quantity: ${parseSupabaseError(error)}`);
              })
            : Promise.resolve(),
        ]);

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
        uploadItemsRef.current.forEach((it) => {
          if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        });
        setUploadItems([]);
        setExistingImages([]);
        setErrors({});
      }

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 500);
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setSubmitError(err?.message || 'Failed to save collection. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSubcategoryOptions =
    CATEGORY_SUBCATEGORIES_MAP[formData.stitching_status] || CATEGORY_SUBCATEGORIES_MAP['Unstitched'];

  const getFormTitle = () => {
    if (isRestockMode) return 'Restock Collection Listing';
    if (isEditMode) return 'Edit Collection Listing';
    return 'Add New Collection Listing';
  };

  const getButtonText = () => {
    if (isSubmitting) {
      if (uploadItems.some((it) => it.status === 'uploading')) {
        return 'Finalizing image uploads...';
      }
      return isRestockMode ? 'Restocking Collection...' : isEditMode ? 'Updating Collection...' : 'Creating Collection...';
    }
    return isRestockMode ? 'Restock Collection' : isEditMode ? 'Update Collection' : 'Add Collection';
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-6 text-stone-800 animate-fade-in">
      {/* Restricted Seller Warning Banner */}
      {isRestricted && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-3 text-amber-900 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold flex items-center space-x-2">
              <span>Listing Restricted</span>
              {badgeText && (
                <span className="px-2 py-0.5 text-[10px] uppercase bg-amber-200 text-amber-950 font-extrabold rounded">
                  {badgeText}
                </span>
              )}
            </div>
            <p className="text-amber-800 font-medium">
              {restrictionMessages[0] || 'Your seller account has temporary listing restrictions.'}
            </p>
            {formattedRestrictedUntil && (
              <p className="text-[11px] font-mono text-amber-700">
                Restriction active until: {formattedRestrictedUntil}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-200 pb-4 gap-3">
        <div>
          <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-stone-900 tracking-tight flex items-center space-x-2">
            {isRestockMode ? (
              <RefreshCw className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <Package className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span>{getFormTitle()}</span>
          </h2>
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
              {totalImageCount} of 4 images selected
            </span>
          </div>

          {totalImageCount < 4 && (
            <label className="border-2 border-dashed border-stone-300 hover:border-stone-800 bg-white hover:bg-stone-50 transition-colors rounded-lg p-5 sm:p-8 flex flex-col items-center justify-center cursor-pointer text-center shadow-2xs">
              <Upload className="w-8 h-8 text-stone-500 mb-2" />
              <span className="font-bold text-stone-800 text-xs sm:text-sm uppercase tracking-wide mb-1">
                Click to browse or drag collection photos here
              </span>
              <span className="text-[11px] sm:text-xs text-stone-500 max-w-md">
                Supports JPG, PNG, WEBP (Max 4 images). Photos upload automatically in the background!
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

          {errors.images && <p className="text-xs text-red-600 font-medium">{errors.images}</p>}

          {totalImageCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2">
              {/* Existing Images from DB */}
              {existingImages.map((img, index) => (
                <div
                  key={img.id || img.url || index}
                  className="relative group border border-stone-300 rounded-md overflow-hidden bg-stone-100 aspect-3/4 flex flex-col shadow-xs"
                >
                  <img src={img.url} alt={`Existing Image ${index + 1}`} className="w-full h-full object-cover" />
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full shadow-sm ${
                      index === 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-900/80 text-white backdrop-blur-xs'
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

              {/* Background Upload Items with Progress State */}
              {uploadItems.map((item, index) => {
                const combinedIndex = existingImages.length + index;
                return (
                  <div
                    key={item.id}
                    className="relative group border border-stone-300 rounded-md overflow-hidden bg-stone-100 aspect-3/4 flex flex-col shadow-xs"
                  >
                    <img src={item.previewUrl} alt={`New Photo ${index + 1}`} className="w-full h-full object-cover" />

                    {/* Status Badge */}
                    <span
                      className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full shadow-sm ${
                        item.status === 'success'
                          ? combinedIndex === 0
                            ? 'bg-amber-400 text-stone-950'
                            : 'bg-emerald-600 text-white'
                          : item.status === 'error'
                          ? 'bg-red-600 text-white'
                          : 'bg-stone-900/80 text-amber-300'
                      }`}
                    >
                      {item.status === 'uploading'
                        ? 'Uploading...'
                        : item.status === 'error'
                        ? 'Failed'
                        : combinedIndex === 0
                        ? 'Primary'
                        : `Ready`}
                    </span>

                    {/* Uploading Spinner Overlay */}
                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-1 text-white p-2">
                        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                        <span className="text-[10px] font-bold">Uploading...</span>
                      </div>
                    )}

                    {/* Error Overlay with Retry */}
                    {item.status === 'error' && (
                      <div className="absolute inset-0 bg-red-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center text-white space-y-2">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-red-200 line-clamp-2">
                          {item.errorMsg || 'Upload failed'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRetryUpload(item)}
                          className="px-2 py-1 bg-white text-red-950 text-[10px] font-bold uppercase rounded shadow-sm hover:bg-red-100 flex items-center space-x-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveUploadItem(item.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition-transform hover:scale-110 cursor-pointer z-10"
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
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] ${
                  errors.brand ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
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
                className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${
                  errors.suit_title ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
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
                className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${
                  errors.fabric ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
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
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] ${
                  errors.stitching_status ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
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

            {/* Subcategory Dropdown */}
            <div>
              <label className="font-bold text-stone-900 block mb-1 uppercase tracking-wide">
                Subcategory <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.piece_count}
                onChange={(e) => handleInputChange('piece_count', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:outline-none bg-white min-h-[42px] ${
                  errors.piece_count ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
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
                  placeholder="6500"
                  value={formData.original_retail_price}
                  onChange={(e) => handleInputChange('original_retail_price', e.target.value)}
                  className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] ${
                    errors.original_retail_price
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
                  placeholder="3500"
                  value={formData.surplus_selling_price}
                  onChange={(e) => handleInputChange('surplus_selling_price', e.target.value)}
                  className={`w-full p-3 pl-10 border rounded-lg focus:outline-none min-h-[42px] ${
                    errors.surplus_selling_price
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

          {/* Stock Section */}
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
                      className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100 hover:border-stone-400'
                      }`}
                    >
                      {sz} {isSelected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>

              {/* Compact Quantity Inputs */}
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
                className={`w-full p-3 border rounded-lg focus:outline-none min-h-[42px] ${
                  errors.quantity ? 'border-red-500 focus:border-red-600' : 'border-stone-300 focus:border-stone-900'
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
