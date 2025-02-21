import EditListingForm from "./EditListingForm"

interface EditListingPageProps {
  params: Promise<{ id: string }>
}

export default async function EditListingPage({ params }: EditListingPageProps) {
  const resolvedParams = await params
  return <EditListingForm listingId={resolvedParams.id} />
}
