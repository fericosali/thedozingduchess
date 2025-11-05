import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormGroup,
  FormControlLabel,
  Checkbox,
  FormLabel,
} from '@mui/material';
import { Plus, Edit, Trash2, Package, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  product_url: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  variant: string;
  sku: string;
  size: string;
  created_at: string;
  updated_at: string;
}

interface NewVariant {
  name: string;
  sku: string;
  sizes: string[];
}

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openProductDialog, setOpenProductDialog] = useState(false);
  const [openVariantDialog, setOpenVariantDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // Combined product creation state
  const [activeStep, setActiveStep] = useState(0);
  const [productForm, setProductForm] = useState({
    product_url: '',
    name: '',
  });
  const [newVariants, setNewVariants] = useState<NewVariant[]>([]);
  const [currentVariant, setCurrentVariant] = useState<NewVariant>({
    name: '',
    sku: '',
    sizes: [],
  });

  // Variant form state for standalone variant creation
  const [variantForm, setVariantForm] = useState({
    product_id: '',
    name: '',
    sku: '',
    size: '',
  });

  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const steps = ['Product Details', 'Add Variants', 'Review & Create'];

  useEffect(() => {
    fetchProducts();
    fetchVariants();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    }
  };

  const fetchVariants = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVariants(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch variants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProductWithVariants = async () => {
    try {
      console.log('Creating product with form data:', productForm);
      console.log('New variants to create:', newVariants);
      
      // First create the product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert([productForm])
        .select()
        .single();

      if (productError) {
        console.error('Product creation error:', productError);
        if (productError.code === '23505' && productError.message.includes('products_product_url_key')) {
          throw new Error('This product URL already exists. Please use a different URL.');
        }
        throw productError;
      }

      console.log('Product created successfully:', productData);

      // Then create all variants - expand each variant with multiple sizes into separate entries
      if (newVariants.length > 0) {
        const variantsToInsert = [];
        
        for (const variant of newVariants) {
          // Create a separate database entry for each size
          for (const size of variant.sizes) {
            variantsToInsert.push({
              variant: variant.sku, // Use the user-entered SKU as the variant base (e.g., "elara_bunny")
              size: size,
              product_id: productData.id,
            });
          }
        }

        console.log('Variants to insert:', variantsToInsert);

        const { data: variantsData, error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert)
          .select();

        if (variantsError) {
          console.error('Variants creation error:', variantsError);
          throw variantsError;
        }

        console.log('Variants created successfully:', variantsData);
        setVariants([...variantsData, ...variants]);
      }

      setProducts([productData, ...products]);
      resetProductDialog();
    } catch (err) {
      console.error('Full error details:', err);
      setError(err instanceof Error ? err.message : 'Failed to create product');
    }
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .update(productForm)
        .eq('id', selectedProduct.id)
        .select()
        .single();

      if (error) throw error;

      setProducts(products.map(p => p.id === selectedProduct.id ? data : p));
      resetProductDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product and all its variants?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== productId));
      setVariants(variants.filter(v => v.product_id !== productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  const handleCreateVariant = async () => {
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .insert([{
          product_id: variantForm.product_id,
          variant: variantForm.name, // Map name to variant field
          size: variantForm.size,
          // SKU will be auto-generated by the database
        }])
        .select()
        .single();

      if (error) throw error;

      setVariants([data, ...variants]);
      setOpenVariantDialog(false);
      setVariantForm({
        product_id: '',
        name: '',
        sku: '',
        size: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variant');
    }
  };

  const handleUpdateVariant = async () => {
    if (!selectedVariant) return;

    try {
      const { data, error } = await supabase
        .from('product_variants')
        .update({
          product_id: variantForm.product_id,
          variant: variantForm.name, // Map name to variant field
          size: variantForm.size,
          // SKU should not be updated as it's auto-generated
        })
        .eq('id', selectedVariant.id)
        .select()
        .single();

      if (error) throw error;

      setVariants(variants.map(v => v.id === selectedVariant.id ? data : v));
      setOpenVariantDialog(false);
      setSelectedVariant(null);
      setVariantForm({
        product_id: '',
        name: '',
        sku: '',
        size: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update variant');
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('Are you sure you want to delete this variant?')) return;

    try {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', variantId);

      if (error) throw error;

      setVariants(variants.filter(v => v.id !== variantId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variant');
    }
  };

  const openEditProductDialog = (product: Product) => {
    setSelectedProduct(product);
    setProductForm({
      product_url: product.product_url,
      name: product.name,
    });
    setActiveStep(0);
    setOpenProductDialog(true);
  };

  const openEditVariantDialog = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setVariantForm({
      product_id: variant.product_id,
      name: variant.variant,
      sku: variant.sku,
      size: variant.size,
    });
    setOpenVariantDialog(true);
  };

  const resetProductDialog = () => {
    setOpenProductDialog(false);
    setSelectedProduct(null);
    setActiveStep(0);
    setProductForm({ product_url: '', name: '' });
    setNewVariants([]);
    setCurrentVariant({ name: '', sku: '', sizes: [] });
  };

  const addVariantToList = () => {
    if (!currentVariant.name || !currentVariant.sku || currentVariant.sizes.length === 0) {
      setError('Please fill in variant name, SKU, and select at least one size');
      return;
    }

    // Check for duplicate base SKU (since we'll append size to make unique SKUs)
    const baseSkuExists = newVariants.some(v => v.sku === currentVariant.sku);
    if (baseSkuExists) {
      setError('Base SKU must be unique (size will be appended automatically)');
      return;
    }

    // Check if any of the generated SKUs would conflict with existing variants
    const existingSkus = variants.map(v => v.sku);
    const wouldConflict = currentVariant.sizes.some(size => 
      existingSkus.includes(`${currentVariant.sku}_${size.toLowerCase()}`)
    );
    
    if (wouldConflict) {
      setError('One or more generated SKUs would conflict with existing variants');
      return;
    }

    setNewVariants([...newVariants, currentVariant]);
    setCurrentVariant({ name: '', sku: '', sizes: [] });
    setError(null);
  };

  const removeVariantFromList = (index: number) => {
    setNewVariants(newVariants.filter((_, i) => i !== index));
  };

  const handleSizeChange = (size: string, checked: boolean) => {
    if (checked) {
      setCurrentVariant({ 
        ...currentVariant, 
        sizes: [...currentVariant.sizes, size] 
      });
    } else {
      setCurrentVariant({ 
        ...currentVariant, 
        sizes: currentVariant.sizes.filter(s => s !== size) 
      });
    }
  };

  const getTotalVariantsToCreate = () => {
    return newVariants.reduce((total, variant) => total + variant.sizes.length, 0);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!productForm.name || !productForm.product_url) {
        setError('Please fill in product name and supplier URL');
        return;
      }
      
      // Validate URL format
      try {
        new URL(productForm.product_url);
      } catch {
        setError('Please enter a valid URL (e.g., https://example.com)');
        return;
      }
    }
    
    if (activeStep === 1) {
      if (newVariants.length === 0) {
        setError('Please add at least one variant before proceeding');
        return;
      }
    }
    
    setError(null);
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product ? product.name : 'Unknown Product';
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Product Name"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Supplier URL"
              value={productForm.product_url}
              onChange={(e) => setProductForm({ ...productForm, product_url: e.target.value })}
              fullWidth
              required
              placeholder="https://example.com/product-page"
              helperText="URL where this product can be purchased"
            />
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Add Product Variants
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add different sizes, colors, or styles for your product. You can add multiple variants.
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                New Variant
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Variant Name"
                    value={currentVariant.name}
                    onChange={(e) => setCurrentVariant({ ...currentVariant, name: e.target.value })}
                    fullWidth
                    placeholder="e.g., Classic Pajama Set"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="SKU"
                    value={currentVariant.sku}
                    onChange={(e) => setCurrentVariant({ ...currentVariant, sku: e.target.value })}
                    fullWidth
                    placeholder="e.g., elara_bunny"
                    helperText="Size will be appended automatically (e.g., elara_bunny_m)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend" sx={{ mb: 1, fontWeight: 600 }}>
                      Select Sizes
                    </FormLabel>
                    <FormGroup row>
                      {sizes.map((size) => (
                        <FormControlLabel
                          key={size}
                          control={
                            <Checkbox
                              checked={currentVariant.sizes.includes(size)}
                              onChange={(e) => handleSizeChange(size, e.target.checked)}
                              sx={{ '&.Mui-checked': { color: '#e91e63' } }}
                            />
                          }
                          label={size}
                        />
                      ))}
                    </FormGroup>
                    {currentVariant.sizes.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        {currentVariant.sizes.length} size{currentVariant.sizes.length > 1 ? 's' : ''} selected
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
              </Grid>
              <Button
                variant="outlined"
                onClick={addVariantToList}
                sx={{ alignSelf: 'flex-start', mt: 1 }}
              >
                Add Variant
              </Button>
            </Box>

            {newVariants.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Added Variants ({newVariants.length})
                </Typography>
                
                {/* Preview of total variants to be created */}
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>{getTotalVariantsToCreate()} database entries</strong> will be created from these {newVariants.length} variant{newVariants.length > 1 ? 's' : ''}
                  </Typography>
                </Alert>

                <List>
                  {newVariants.map((variant, index) => (
                    <ListItem key={index} divider>
                      <ListItemText
                        primary={variant.name}
                        secondary={
                          <>
                            SKU: {variant.sku}
                            <br />
                            Sizes: {variant.sizes.join(', ')} ({variant.sizes.length} size{variant.sizes.length > 1 ? 's' : ''})
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => removeVariantFromList(index)}
                          sx={{ color: '#f44336' }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 1 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Review & Create
            </Typography>
            
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                  Product Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Name:</Typography>
                    <Typography variant="body1">{productForm.name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Supplier URL:</Typography>
                    <Typography variant="body1">{productForm.product_url}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {newVariants.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Variants to Create ({getTotalVariantsToCreate()} database entries)
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Variant Name</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell>Size</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {newVariants.map((variant, variantIndex) => 
                          variant.sizes.map((size, sizeIndex) => (
                            <TableRow key={`${variantIndex}-${sizeIndex}`}>
                              <TableCell>{variant.name}</TableCell>
                              <TableCell>{variant.sku}_{size.toLowerCase()}</TableCell>
                              <TableCell>{size}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Each variant-size combination will be created as a separate database entry with a unique SKU.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Box>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Loading products...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>
          Product Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={() => setOpenProductDialog(true)}
            sx={{ 
              bgcolor: '#e91e63', 
              '&:hover': { bgcolor: '#c2185b' },
              px: 3,
              py: 1.5,
            }}
          >
            Add Product
          </Button>
          <Button
            variant="outlined"
            startIcon={<Package size={20} />}
            onClick={() => setOpenVariantDialog(true)}
            sx={{ 
              borderColor: '#e91e63', 
              color: '#e91e63', 
              '&:hover': { borderColor: '#c2185b', bgcolor: '#fce4ec' },
              px: 3,
              py: 1.5,
            }}
          >
            Add Variant Only
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Products Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Products
          </Typography>
          <Grid container spacing={3}>
            {products.map((product) => (
              <Grid item xs={12} sm={6} md={4} key={product.id}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {product.name}
                      </Typography>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => openEditProductDialog(product)}
                          sx={{ color: '#e91e63' }}
                        >
                          <Edit size={16} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteProduct(product.id)}
                          sx={{ color: '#f44336' }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Box>
                    </Box>
                    {product.product_url && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        <a 
                          href={product.product_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#e91e63', 
                            textDecoration: 'none'
                          }}
                          onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                          onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
                        >
                          View Supplier Page →
                        </a>
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                      Variants: {variants.filter(v => v.product_id === product.id).length}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Variants Section */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
            Product Variants
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Variant Name</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Size</TableCell>

                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell>{getProductName(variant.product_id)}</TableCell>
                    <TableCell>{variant.variant}</TableCell>
                    <TableCell>{variant.sku}</TableCell>
                    <TableCell>{variant.size}</TableCell>

                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => openEditVariantDialog(variant)}
                        sx={{ color: '#e91e63' }}
                      >
                        <Edit size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteVariant(variant.id)}
                        sx={{ color: '#f44336' }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Combined Product Creation Dialog */}
      <Dialog 
        open={openProductDialog} 
        onClose={resetProductDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { minHeight: '600px' }
        }}
      >
        <DialogTitle>
          {selectedProduct ? 'Edit Product' : 'Create New Product'}
        </DialogTitle>
        <DialogContent>
          {!selectedProduct && (
            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}
          
          {selectedProduct ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Product Name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Supplier URL"
                value={productForm.product_url}
                onChange={(e) => setProductForm({ ...productForm, product_url: e.target.value })}
                fullWidth
                required
                placeholder="https://example.com/product-page"
                helperText="URL where this product can be purchased"
              />
            </Box>
          ) : (
            renderStepContent(activeStep)
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
          <Box>
            {!selectedProduct && activeStep > 0 && (
              <Button onClick={handleBack} startIcon={<ArrowLeft size={16} />}>
                Back
              </Button>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={resetProductDialog}>Cancel</Button>
            {selectedProduct ? (
              <Button
                onClick={handleUpdateProduct}
                variant="contained"
                sx={{ bgcolor: '#e91e63', '&:hover': { bgcolor: '#c2185b' } }}
              >
                Update Product
              </Button>
            ) : (
              <>
                {activeStep < steps.length - 1 ? (
                  <Button
                    onClick={handleNext}
                    variant="contained"
                    endIcon={<ArrowRight size={16} />}
                    sx={{ bgcolor: '#e91e63', '&:hover': { bgcolor: '#c2185b' } }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateProductWithVariants}
                    variant="contained"
                    sx={{ bgcolor: '#e91e63', '&:hover': { bgcolor: '#c2185b' } }}
                  >
                    Create Product
                  </Button>
                )}
              </>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Standalone Variant Dialog */}
      <Dialog open={openVariantDialog} onClose={() => setOpenVariantDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedVariant ? 'Edit Variant' : 'Add New Variant'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Product</InputLabel>
              <Select
                value={variantForm.product_id}
                onChange={(e) => setVariantForm({ ...variantForm, product_id: e.target.value })}
                label="Product"
              >
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Variant Name"
              value={variantForm.name}
              onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="SKU"
              value={variantForm.sku}
              onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Size</InputLabel>
              <Select
                 value={variantForm.size}
                 onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                 label="Size"
               >
                 {sizes.map((size) => (
                   <MenuItem key={size} value={size}>
                     {size}
                   </MenuItem>
                 ))}
               </Select>
            </FormControl>

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVariantDialog(false)}>Cancel</Button>
          <Button
            onClick={selectedVariant ? handleUpdateVariant : handleCreateVariant}
            variant="contained"
            sx={{ bgcolor: '#e91e63', '&:hover': { bgcolor: '#c2185b' } }}
          >
            {selectedVariant ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Products;